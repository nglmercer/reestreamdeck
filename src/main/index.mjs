import { app, shell, BrowserWindow, ipcMain, globalShortcut } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import AudioController from "./audioController";
import keynut from "./keynut";
import injectQRCode, { getLocalIPAddress} from "./server/listenserver";
import path from "path";
import FileOpener from "./FileOpener";
import fs from "fs";
import fileIndexer from "./FindFiles";
import SocketHandler from "./server/socketServer";
import { HttpExpressServer, HttpsExpressServer } from "./server/ExpressServe";

const socketHandler = new SocketHandler();
const newsocketHandler = new SocketHandler();
const httpServer = new HttpExpressServer();
const httpsServer = new HttpsExpressServer();
let Port;
const fileOpener = new FileOpener();

let io;
// let privateKey, certificate, credentials;
if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
}
async function startServers() {
  const httpPort = 3333;
  const httpsPort = 0;
  const privateKey = fs.readFileSync(path.join(__dirname, '../../credentials/key.pem'), 'utf8');
  const certificate = fs.readFileSync(path.join(__dirname, '../../credentials/cert.pem'), 'utf8');
  const credentials = { key: privateKey, cert: certificate };
  try {
    await httpServer.initialize(httpPort);
    await httpsServer.initialize(httpsPort, credentials);

    // Agregar rutas a ambos servidores
    const servers = [httpServer, httpsServer];
    servers.forEach(server => {
      server.addRoute("get", "/port", (req, res) => {
        console.log("get port", server.getListenPort());
        res.json({ port: httpsServer.getListenPort() });
      });
      server.addRoute("get", "/apps", async (req, res) => {
        const apps = await getInstalledApplications();
        res.json(apps);
      });
    });
    socketHandler.initialize(httpServer.server);
    newsocketHandler.initialize(httpsServer.server);

    console.log(`HTTP server running on port ${httpServer.getListenPort()}`);
    console.log(`HTTPS server running on port ${httpsServer.getListenPort()}`);
  } catch (error) {
    console.error("Error starting servers:", error);
  }

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

    Port = httpsServer.getListenPort();
}
startServers();

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

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    console.log(process.env["ELECTRON_RENDERER_URL"]);
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
  electronApp.setAppUserModelId("com.electron");
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

