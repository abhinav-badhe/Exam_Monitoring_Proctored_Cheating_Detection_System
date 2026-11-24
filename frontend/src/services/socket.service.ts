import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://127.0.0.1:5000";

let socketInstance: Socket | null = null;

export function getSocket(token?: string): Socket {
  const authToken = token || localStorage.getItem("proctor_token");

  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      auth: {
        token: authToken
      },
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketInstance.on("connect", () => {
      console.log("🟢 Connected to ProctorAI Socket.IO server:", socketInstance?.id);
    });

    socketInstance.on("connect_error", (err) => {
      console.warn("⚠️ Socket.IO connection error:", err.message);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("🔴 Disconnected from Socket.IO server:", reason);
    });
  }

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
