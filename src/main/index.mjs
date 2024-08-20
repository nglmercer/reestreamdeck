import { app, shell, BrowserWindow, ipcMain, globalShortcut } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import express from "express";
import AudioController from "./audioController";
import keynut from "./keynut";
import injectQRCode, { getLocalIPAddress} from "./server/listenserver";
import path from "path";
import FileOpener from "./FileOpener";
import fs from "fs";
import fileIndexer from "./FindFiles";
import SocketHandler from "./server/socketServer";
import ExpressServer from "./server/expressServer";
import e from "express";

const socketHandler = new SocketHandler();
const expressServer = new ExpressServer();
const newexpressServer = new ExpressServer();
let Port;
const fileOpener = new FileOpener();

const fileInfoHandler = (req, res) => {
  const { path: filePath } = req.body;
  console.log("filePath", filePath);

  openfile(filePath);

  fs.stat(filePath, (err, stats) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error obtaining file information");
      return;
    }

    const fileDetails = {
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      fileType: path.extname(filePath),
    };

    res.json(fileDetails);
  });
};

function openfile(path) {
  fileOpener.openDefault(path);
  console.log("openfile", path);
}
console.log("join", join(__dirname, "../renderer/index.html"));

let io;
// let privateKey, certificate, credentials;
if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
  console.log("SSL credentials not found. Starting HTTP server...");
  newexpressServer.initialize(0);  // 0 para que se asigne un puerto disponible automáticamente
} else {
  try {
    // privateKey = fs.readFileSync(join(__dirname, '../../credentials/key.pem'), 'utf8');
    console.log(join(__dirname, '../../credentials/key.pem'));
    console.log(join(__dirname, '../../credentials/cert.pem'));
    const privateKey = fs.readFileSync(path.join(__dirname, '../../credentials/key.pem'), 'utf8');
    const certificate = fs.readFileSync(path.join(__dirname, '../../credentials/cert.pem'), 'utf8');
    const credentials = { key: privateKey, cert: certificate };
    const success = await newexpressServer.initialize(0, credentials);  // Inicia HTTPS
    if (success) {
      Port = newexpressServer.getListenPort();

    }

    console.log("SSL credentials found. Starting HTTPS server...");
  } catch (error) {
  console.log("SSL credentials not found. Starting HTTP server...");

  // Si no hay credenciales, inicia el servidor en HTTP
  expressServer.initialize(0);  // Fallback a HTTP si no hay credenciales SSL
  }
}
async function startServer() {
  const port = 3333;
  const credentials = null; // or the object with credentials if using HTTPS

  const success = await expressServer.initialize(port, credentials);
  if (success) {
    console.log(`Server started and listening on port: ${expressServer.getListenPort()}`);
    // Initialize socket handler after Express server is running
    socketHandler.initialize(expressServer.server);
    socketHandler.onEvent("connection", (socket) => {
      console.log("New client connected:", socket.id);

      sendAudioData(socket);
      const intervalId = setInterval(() => sendAudioData(socket), UPDATE_INTERVAL);

      socket.on("join-room", (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId;
        const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        socket.emit(
          "all-users",
          usersInRoom.filter((id) => id !== socket.id),
        );
        socket.to(roomId).emit("user-connected", socket.id);
        console.log(`User ${socket.id} joined room ${roomId}`);
      });

      socket.on("webrtc", (payload) => {
        const { type, data, to, roomId } = payload;
        console.log(
          `Received WebRTC message of type: ${type} from: ${socket.id} to: ${to}`,
        );

        switch (type) {
          case "offer":
          case "answer":
            if (to) {
              io.to(to).emit("webrtc", { type, data, from: socket.id });
            }
            break;
          case "candidate":
            if (to === "all" || !to) {
              socket.to(roomId).emit("webrtc", { type, data, from: socket.id });
            } else {
              io.to(to).emit("webrtc", { type, data, from: socket.id });
            }
            break;
          default:
            console.warn(`Unhandled WebRTC event type: ${type}`);
        }
      });

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
        if (socket.roomId) {
          socket.to(socket.roomId).emit("user-disconnected", socket.id);
          console.log(`User ${socket.id} disconnected from room ${socket.roomId}`);
        }
        clearInterval(intervalId);
      });
      socket.on("setMasterVolume", (volume) => {
        try {
          audioController.setMasterVolume(volume);
          socket.emit("masterVolumeChanged", volume);
        } catch (error) {
          socket.emit("error", error.message);
        }
      });

      socket.on("presskey", (key) => {
        console.log("Keypressed:", key);
        try {
          keynut.keyboardController.parseAndExecuteKeyCommand(key);
          socket.emit("keypressed", key);
        } catch (error) {
          socket.emit("error", error.message);
        }
      });

      socket.on("setVolume", ({ pid, volume }) => {
        try {
          audioController.setSessionVolume(pid, volume);
          socket.emit("volumeChanged", { pid, volume });
        } catch (error) {
          socket.emit("error", error.message);
        }
      });
      socket.on("openapp", (data) => {
        console.log("openapp", data);
        fileOpener.openDefault(data.path);
        socket.emit("openapp", data);
      });
    });
    // Add routes after server initialization
    expressServer.addRoute("post", "/file-info", fileInfoHandler);
    newexpressServer.addRoute("post", "/file-info", fileInfoHandler);
    expressServer.addRoute("get", "/port", (req, res) => {
      res.json({ port: expressServer.getListenPort() });
    });
    newexpressServer.addRoute("get", "/port", (req, res) => {
      res.json({ port: expressServer.getListenPort() });
    });
    expressServer.addRoute("get", "/apps", async (req, res) => {
      const apps = await getInstalledApplications();
      res.json(apps);
    });
    newexpressServer.addRoute("get", "/apps", async (req, res) => {
      const apps = await getInstalledApplications();
      res.json(apps);
    });
    // Initialize socket
    try {
      const assignedPort = await socketHandler.listensocket(0);
      console.log(`Socket server started and listening on port: ${assignedPort}`);
    } catch (error) {
      console.error("Error starting socket server:", error);
    }
  } else {
    console.log(`Failed to start server on port ${port}`);
  }
}
startServer();

function getInstalledApplications() {
  return fileIndexer.searchFiles(".lnk");
}
function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      // preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
    injectQRCode(mainWindow, Port); // Inyecta el QR cuando la ventana esté lista
    globalShortcut.register("Alt+F1", ToolDev);
    globalShortcut.register("Alt+F2", cdevTool);
    globalShortcut.register("Alt+F5", refreshPage);
    function ToolDev() {
      mainWindow.webContents.openDevTools();
    }

    function cdevTool() {
      mainWindow.webContents.closeDevTools();
    }

    function refreshPage() {
      mainWindow.webContents.reload(); // Reload the page on F5
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    // mainWindow.loadURL(`http://localhost:${Port}`);
    console.log(process.env["ELECTRON_RENDERER_URL"]);
    console.log(Port);
    console.log(join(__dirname, "../renderer/index.html"));
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}
const audioController = new AudioController();
const UPDATE_INTERVAL = 5000;

// console.log(keynut.getKeyboardControlsAsJSONKey());123

function sendAudioData(socket) {
  const sessions = audioController.getAllSessions();
  const masterVolume = audioController.getMasterVolume();
  const isMasterMuted = audioController.isMasterMuted();

  socket.emit("audioData", { sessions, masterVolume, isMasterMuted });
}
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on("toMain", () => console.log("pong"));

  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

