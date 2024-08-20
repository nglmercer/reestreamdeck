import { app, shell, BrowserWindow, globalShortcut } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import fs from "fs";
import path from "path";
import AudioController from "./audioController";
import fileIndexer from "./FindFiles";
import FileOpener from "./FileOpener";
import keynut from "./keynut";
import SocketHandler from "./server/socketServer";
import { HttpExpressServer, HttpsExpressServer } from "./server/ExpressServe";
import injectQRCode from "./server/listenserver";
let Port;
let io
const fileOpener = new FileOpener();
const socketHandler = new SocketHandler();
const newsocketHandler = new SocketHandler();
const httpServer = new HttpExpressServer();
const httpsServer = new HttpsExpressServer();
const audioController = new AudioController();
const UPDATE_INTERVAL = 5000;

async function startServer() {
  const httpPort = 3333;
  const httpsPort = 0;

  const privateKey = fs.readFileSync(path.join(__dirname, '../../credentials/key.pem'), 'utf8');
  const certificate = fs.readFileSync(path.join(__dirname, '../../credentials/cert.pem'), 'utf8');
  const credentials = { key: privateKey, cert: certificate };

    await httpServer.initialize(httpPort);
    await httpsServer.initialize(httpsPort, credentials);

    const servers = [httpServer, httpsServer];
    const sockets = [socketHandler, newsocketHandler];

    servers.forEach((server, index) => {
      server.addRoute("get", "/port", (req, res) => {
        res.json({ port: server.getListenPort() });
      });

      server.addRoute("get", "/apps", async (req, res) => {
        const apps = await getInstalledApplications();
        res.json(apps);
      });

      sockets[index].initialize(server.server);

      sockets[index].onEvent("connection", (socket) => handleSocketEvents(socket, index));
    });

    console.log(`HTTP server running on port ${httpServer.getListenPort()}`);
    console.log(`HTTPS server running on port ${httpsServer.getListenPort()}`);
    Port = httpsServer.getListenPort();
    return httpsServer.getListenPort();
}
startServer()
function handleSocketEvents(socket, index) {
  console.log(`New client connected on socket ${index + 1}:`, socket.id);
  socket.emit("getapps", getInstalledApplications());
  sendAudioData(socket);
  const intervalId = setInterval(() => sendAudioData(socket), UPDATE_INTERVAL);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    socket.emit("all-users", usersInRoom.filter((id) => id !== socket.id));
    socket.to(roomId).emit("user-connected", socket.id);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on("webrtc", (payload) => {
    const { type, data, to, roomId } = payload;
    if (to) {
      io.to(to).emit("webrtc", { type, data, from: socket.id });
    } else if (type === "candidate" && (!to || to === "all")) {
      socket.to(roomId).emit("webrtc", { type, data, from: socket.id });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    clearInterval(intervalId);
  });

  socket.on("setMasterVolume", (volume) => handleVolumeChange(socket, volume));
  socket.on("presskey", (key) => handleKeyPress(socket, key));
  socket.on("setVolume", ({ pid, volume }) => handleSessionVolumeChange(socket, pid, volume));
  socket.on("openapp", (data) => handleAppOpen(socket, data));
}

function handleVolumeChange(socket, volume) {
  try {
    audioController.setMasterVolume(volume);
    socket.emit("masterVolumeChanged", volume);
  } catch (error) {
    socket.emit("error", error.message);
  }
}

function handleKeyPress(socket, key) {
  try {
    keynut.keyboardController.parseAndExecuteKeyCommand(key);
    socket.emit("keypressed", key);
  } catch (error) {
    socket.emit("error", error.message);
  }
}

function handleSessionVolumeChange(socket, pid, volume) {
  try {
    audioController.setSessionVolume(pid, volume);
    socket.emit("volumeChanged", { pid, volume });
  } catch (error) {
    socket.emit("error", error.message);
  }
}

function handleAppOpen(socket, data) {
  fileOpener.openDefault(data.path);
  socket.emit("openapp", data);
}

function getInstalledApplications() {
  return fileIndexer.searchFiles(".lnk");
}

function sendAudioData(socket) {
  const sessions = audioController.getAllSessions();
  const masterVolume = audioController.getMasterVolume();
  const isMasterMuted = audioController.isMasterMuted();
  socket.emit("audioData", { sessions, masterVolume, isMasterMuted });
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
    // initinjectQRCode(mainWindow, Port); // Inyecta el QR cuando la ventana esté lista
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
    // console.log(process.env["ELECTRON_RENDERER_URL"]);
    // console.log(join(__dirname, "../renderer/index.html"));
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
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

