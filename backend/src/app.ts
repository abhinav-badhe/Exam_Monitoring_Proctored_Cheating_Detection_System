import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import examRoutes from "./routes/exam.routes";
import attemptRoutes from "./routes/attempt.routes";
import proctorRoutes from "./routes/proctor.routes";

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin like mobile apps, curl, postman
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Dev-permissive
    },
    credentials: true
  })
);

app.use(express.json());

// Health Check API
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "ProctorAI Backend API is healthy and operational",
    timestamp: new Date().toISOString()
  });
});

// Main API Routes
app.use("/api/auth", authRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/attempts", attemptRoutes);
app.use("/api/proctor", proctorRoutes);

// Fallback 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({
    success: false,
    message: "An internal server error occurred"
  });
});

export default app;
