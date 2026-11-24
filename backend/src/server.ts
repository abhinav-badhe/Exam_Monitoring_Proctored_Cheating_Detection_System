import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { prisma } from "./config/database";
import { initSocket } from "./socket";

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await prisma.$connect();
    console.log("✅ PostgreSQL Database connected successfully");

    const httpServer = http.createServer(app);
    initSocket(httpServer);
    console.log("✅ Socket.IO Real-Time Server initialized");

    httpServer.listen(PORT, () => {
      console.log(`🚀 ProctorAI API server running on http://localhost:${PORT}`);
      console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("❌ Fatal server startup error:", error);
    process.exit(1);
  }
}

startServer();
