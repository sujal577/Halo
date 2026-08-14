import { io } from 'socket.io-client';

let socket;

const getSocket = () => {
  if (!socket) {
    // Automatically connect to current origin (proxied by Vite to port 3002)
    const socketUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3002";
    socket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
};

const setSocket = () => {
  if (socket) {
    socket.disconnect();
  }
  socket = null;
};

export default {
  getSocket,
  setSocket,
};