import { io } from "socket.io-client";

class SocketManager {
  constructor() {
    this.socket = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log("SocketManager is already initialized.");
      return;
    }

    try {
      const port = window.location.port || 3333;
      let socketUrl;

      if (port === '5173') {
        console.log("port", port);
        socketUrl = this.constructSocketUrl(3333);
      } else {
        console.log("port", port);
        socketUrl = this.constructSocketUrl(port);
      }

      this.socket = io(socketUrl);
      this.isInitialized = true;

      // Escuchar el evento 'connect' para confirmar que la conexión es exitosa
      this.socket.on("connect", () => {
        console.log("Socket connected successfully");
      });
    } catch (error) {
      console.error("Error initializing socket:", error);
    }
  }

  constructSocketUrl(port) {
    const { protocol, hostname } = window.location;

    if (protocol === "file:") {
      console.log("protocol", protocol);
      return `http://localhost:${port}`;
    } else if (protocol === "https:") {
      console.log(`${protocol}//${hostname}:${port}`);
      return `${protocol}//${hostname}:${port}`;
    } else if (protocol === "http:") {
      console.log("protocol", protocol, `http://${hostname}:${port}`);
      return `http://${hostname}:${port}`;
    }
  }

  emitMessage(eventName, data) {
    if (this.socket) {
      // console.log("emitMessage", eventName, data);
      this.socket.emit(eventName, data);
    } else {
      console.error("Socket is not initialized");
    }
  }

  onMessage(eventName, callback) {
    if (this.socket) {
      this.socket.on(eventName, callback);
    } else {
      console.error("Socket is not initialized");
    }
  }

  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.isInitialized = false;
    } else {
      console.error("Socket is not initialized");
    }
  }
}

const socketManager = new SocketManager();
socketManager.initialize();
export default socketManager;
