import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";

interface SocketUser {
  userId: string;
  email: string;
  role: string;
  fullName?: string;
}

declare module "socket.io" {
  interface SocketData {
    user?: SocketUser;
  }
}

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Authentication middleware
  io.use((socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.auth?.token || socket.handshake.headers.authorization;
      if (!authHeader) {
        return next(new Error("Authentication error: No token provided"));
      }

      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
      const secret = process.env.JWT_SECRET || "proctorai_secret_jwt_key_2026";
      const decoded = jwt.verify(token, secret) as SocketUser;

      socket.data.user = decoded;
      return next();
    } catch (err: any) {
      return next(new Error(`Authentication error: ${err.message}`));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user;

    // Examiner joins exam monitoring room
    socket.on("join:exam", (examId: string) => {
      if (!examId) return;
      const room = `exam:${examId}`;
      socket.join(room);
    });

    socket.on("leave:exam", (examId: string) => {
      if (!examId) return;
      socket.leave(`exam:${examId}`);
    });

    // Candidate joins attempt-specific room
    socket.on("join:attempt", (attemptId: string) => {
      if (!attemptId) return;
      const room = `attempt:${attemptId}`;
      socket.join(room);
    });

    socket.on("leave:attempt", (attemptId: string) => {
      if (!attemptId) return;
      socket.leave(`attempt:${attemptId}`);
    });

    // Examiner sends direct live warning to candidate
    socket.on("examiner:warn_candidate", (payload: { attemptId: string; examId: string; warningMessage: string }) => {
      if (!payload.attemptId || !payload.warningMessage) return;

      broadcastCandidateWarning(payload.attemptId, payload.examId, {
        attemptId: payload.attemptId,
        warningMessage: payload.warningMessage,
        sentBy: user?.fullName || "Exam Proctor",
        timestamp: new Date().toISOString()
      });
    });

    // Examiner freezes candidate session
    socket.on("examiner:freeze_attempt", (payload: { attemptId: string; examId: string; reason?: string }) => {
      if (!payload.attemptId) return;

      broadcastSessionFrozen(payload.attemptId, payload.examId, {
        attemptId: payload.attemptId,
        reason: payload.reason || "Exam session paused by proctor for integrity check.",
        sentBy: user?.fullName || "Exam Proctor",
        timestamp: new Date().toISOString()
      });
    });

    // Examiner resumes/unfreezes candidate session
    socket.on("examiner:unfreeze_attempt", (payload: { attemptId: string; examId: string }) => {
      if (!payload.attemptId) return;

      broadcastSessionResumed(payload.attemptId, payload.examId, {
        attemptId: payload.attemptId,
        sentBy: user?.fullName || "Exam Proctor",
        timestamp: new Date().toISOString()
      });
    });

    // Examiner force submits candidate session
    socket.on("examiner:force_submit", (payload: { attemptId: string; examId: string; reason: string; disqualified?: boolean }) => {
      if (!payload.attemptId) return;

      broadcastForceSubmitted(payload.attemptId, payload.examId, {
        attemptId: payload.attemptId,
        reason: payload.reason,
        disqualified: !!payload.disqualified,
        sentBy: user?.fullName || "Exam Proctor",
        timestamp: new Date().toISOString()
      });
    });

    socket.on("disconnect", () => {
      // Socket disconnected
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO has not been initialized yet");
  }
  return io;
}

export function broadcastExamAlert(examId: string, alertData: any) {
  if (!io) return;
  io.to(`exam:${examId}`).emit("exam:proctor_alert", alertData);
}

export function broadcastCandidateStatus(examId: string, statusData: any) {
  if (!io) return;
  io.to(`exam:${examId}`).emit("exam:candidate_status", statusData);
}

export function broadcastCandidateWarning(attemptId: string, examId: string, payload: any) {
  if (!io) return;
  io.to(`attempt:${attemptId}`).emit("candidate:warning", payload);
  io.to(`exam:${examId}`).emit("exam:warning_issued", payload);
}

export function broadcastSessionFrozen(attemptId: string, examId: string, payload: any) {
  if (!io) return;
  io.to(`attempt:${attemptId}`).emit("candidate:session_frozen", payload);
  io.to(`exam:${examId}`).emit("exam:candidate_status", {
    attemptId,
    isFrozen: true,
    frozenReason: payload.reason,
    timestamp: payload.timestamp || new Date().toISOString()
  });
}

export function broadcastSessionResumed(attemptId: string, examId: string, payload: any) {
  if (!io) return;
  io.to(`attempt:${attemptId}`).emit("candidate:session_resumed", payload);
  io.to(`exam:${examId}`).emit("exam:candidate_status", {
    attemptId,
    isFrozen: false,
    timestamp: payload.timestamp || new Date().toISOString()
  });
}

export function broadcastForceSubmitted(attemptId: string, examId: string, payload: any) {
  if (!io) return;
  io.to(`attempt:${attemptId}`).emit("candidate:force_submitted", payload);
  io.to(`exam:${examId}`).emit("exam:candidate_status", {
    attemptId,
    status: "AUTO_SUBMITTED",
    disqualified: payload.disqualified,
    reason: payload.reason,
    timestamp: payload.timestamp || new Date().toISOString()
  });
}
