import { io } from "socket.io-client";
class SocketManager {
  static instance = null;
  socket = null;

  static async create() {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
      await SocketManager.instance.initialize();
    }
    return SocketManager.instance;
  }

  async initialize() {
    const port = window.location.port || 3333;
    if (port === 5173 || port === '5173') {
      console.log("port", port);
      const socketUrl = this.constructSocketUrl(3333);
      this.socket = io(socketUrl);
    } else {
      console.log("port", port);
      const socketUrl = this.constructSocketUrl(port);
      this.socket = io(socketUrl);
    }

  }
  constructSocketUrl(port) {
    const { protocol, hostname } = window.location;
    if (protocol === "file:") {
      console.log("protocol", protocol);
      return `http://localhost:${port}`;
    } else if (protocol === "https:") {
      console.log(`${protocol}//${hostname}:${window.location.port}`);
      return `${protocol}//${hostname}:${window.location.port}`;
    } else if (protocol === "http:") {
      console.log("protocol", protocol, `http://${window.location.hostname}:${port}`);
      return `http://${window.location.hostname}:${port}`;
    }
  }

  emitMessage(eventName, data) {
    if (this.socket) {
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
    } else {
      console.error("Socket is not initialized");
    }
  }
}

const socketManager = await SocketManager.create();
Object.freeze(socketManager);

export default socketManager;
