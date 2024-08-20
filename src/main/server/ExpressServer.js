import express from "express";
import cors from "cors";
import http from "http";
import https from "https";
import { join } from "path";
import os from "os";

class ExpressServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.isConnected = false;
    this.port = null;
    this.ip = this.getLocalIP();
  }
  getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
          return alias.address;
        }
      }
    }
    return '0.0.0.0';  // fallback to all interfaces if no specific IP is found
  }
  initialize = (port = 3000, credentials = null) => {
    console.log("Initializing Express server...");

    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, "../renderer")));
    // Si se pasan credenciales, inicia un servidor HTTPS; de lo contrario, inicia HTTP
    if (credentials) {
      this.server = https.createServer(credentials, this.app);
      console.log("Starting HTTPS server...");
    } else {
      this.server = http.createServer(this.app);
      console.log("Starting HTTP server...");
    }

    return this.listenOnPort(port); // Devuelve una promesa para manejar la inicialización
  }

  listenOnPort = (port) => {
    return new Promise((resolve) => {
      if (this.isConnected) {
        console.log("Server is already running. Closing existing connection...");
        this.close(() => {
          this.startListening(port, resolve);
        });
      } else {
        this.startListening(port, resolve);
      }
    });
  }

  startListening = (port, resolve) => {
    this.server.listen(port, () => {
      this.port = this.server.address().port;
      console.log(`Express server is running on port ${this.port}`);
      this.isConnected = true;
      resolve(true);
    });

    this.server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is already in use`);
        resolve(false);
      } else {
        console.error(`Error starting server on port ${port}:`, err);
        resolve(false);
      }
    });
  }

  onEvent = (eventName, callback) => {
    this.app.on(eventName, callback);
  }

  addRoute = (method, path, handler) => {
    switch (method.toLowerCase()) {
      case 'get':
        this.app.get(path, handler);
        break;
      case 'post':
        this.app.post(path, handler);
        break;
      case 'put':
        this.app.put(path, handler);
        break;
      case 'delete':
        this.app.delete(path, handler);
        break;
      default:
        console.error(`Unsupported HTTP method: ${method}`);
    }
  }

  onDisconnect = (callback) => {
    this.server.on("close", callback);
  }

  close = (callback) => {
    if (this.server) {
      this.server.close(() => {
        console.log("Express server closed");
        this.isConnected = false;
        if (callback) callback();
      });
    } else if (callback) {
      callback();
    }
  }

  getListenPort = () => {
    return this.port;
  }
}

export default ExpressServer;
