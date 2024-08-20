import { Server } from "socket.io";

class SocketHandler {
  constructor() {
    this.io = null;
    this.server = null;
    this.isConnected = false;
    this.port = null;
    this.isInitialized = false;
  }

  initialize = (server) => {
    this.server = server;
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });
    this.isConnected = true;
    this.isInitialized = true;
  }

  onEvent = (eventName, callback) => {
    this.io.on(eventName, callback);
  }

  onConnection = (callback) => {
    this.io.on("connection", callback);
  }

  emit = (eventName, data) => {
    this.io.emit(eventName, data);
  }

  onDisconnect = (callback) => {
    this.io.on("disconnect", callback);
  }

  disconnectSocket = (socket) => {
    if (socket) {
      this.io.sockets.emit("disconnect", socket.id);
    }
  }

  listensocket = async (port = 0) => {
    // if (this.isInitialized) {
    //   console.log("Socket server is already listening.");
    //   return Promise.resolve(this.port);
    // }
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(port, () => {
          this.port = this.server.address().port;
          console.log("Socket.IO server listening on port", this.port);
          this.isInitialized = true;
          resolve(this.port);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  getListenPort = () => {
    console.log("getListenPort", this.port);
    return this.port;
  }
}

export default SocketHandler;
