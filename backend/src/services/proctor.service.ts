import { prisma } from "../config/database";
import { IngestEventsInput, SingleProctorEvent } from "../validators/proctor.validator";
import { AttemptStatus, EventSeverity, UserRole, RiskLevel } from "@prisma/client";
import { broadcastExamAlert } from "../socket";
import { storageService } from "./storage.service";
import fs from "fs";
import path from "path";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
const EVIDENCE_DIR = path.resolve(process.cwd(), "..", "storage", "evidence");

const DEFAULT_SEVERITIES: Record<string, EventSeverity> = {
  TAB_HIDDEN: EventSeverity.HIGH,
  TAB_VISIBLE: EventSeverity.INFO,
  WINDOW_BLUR: EventSeverity.MEDIUM,
  WINDOW_FOCUS: EventSeverity.INFO,
  FULLSCREEN_EXIT: EventSeverity.HIGH,
  FULLSCREEN_ENTER: EventSeverity.INFO,
  COPY_ATTEMPT: EventSeverity.HIGH,
  PASTE_ATTEMPT: EventSeverity.HIGH,
  CONTEXT_MENU_ATTEMPT: EventSeverity.LOW,
  DEVTOOLS_SHORTCUT: EventSeverity.CRITICAL,
  EXTENSION_SHORTCUT_ATTEMPT: EventSeverity.CRITICAL,
  UNAUTHORIZED_SHORTCUT: EventSeverity.HIGH,
  EXTENSION_DOM_INJECTION: EventSeverity.CRITICAL,
  VOICE_ACTIVITY_DETECTED: EventSeverity.HIGH,
  HIGH_NOISE_LEVEL: EventSeverity.MEDIUM,
  INTERACTION_SUMMARY: EventSeverity.INFO,
  KEYBOARD_BURST: EventSeverity.LOW,
  PROLONGED_INACTIVITY: EventSeverity.MEDIUM
};

export async function ingestProctorEvents(candidateId: string, data: IngestEventsInput) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: data.attemptId },
    include: {
      candidate: {
        select: { id: true, fullName: true, email: true }
      }
    }
  });

  if (!attempt) {
    throw new Error("Exam attempt not found");
  }

  if (attempt.candidateId !== candidateId) {
    throw new Error("Access denied: You do not own this exam attempt");
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new Error("Cannot log proctor events: Attempt is no longer active");
  }

  const eventsToCreate = data.events.map((evt: SingleProctorEvent) => {
    const calculatedSeverity = evt.severity || DEFAULT_SEVERITIES[evt.eventType] || EventSeverity.INFO;
    const createdAt = evt.timestamp ? new Date(evt.timestamp) : new Date();

    return {
      attemptId: data.attemptId,
      eventType: evt.eventType,
      severity: calculatedSeverity,
      metadata: (evt.metadata as any) ?? {},
      createdAt
    };
  });

  await prisma.proctorEvent.createMany({
    data: eventsToCreate
  });

  // Broadcast high/medium/critical alerts to live examiner room
  for (const evt of eventsToCreate) {
    if (evt.severity !== EventSeverity.INFO || evt.eventType.includes("FULLSCREEN")) {
      broadcastExamAlert(attempt.examId, {
        attemptId: attempt.id,
        candidate: {
          id: attempt.candidate.id,
          fullName: attempt.candidate.fullName,
          email: attempt.candidate.email
        },
        eventType: evt.eventType,
        severity: evt.severity,
        metadata: evt.metadata,
        createdAt: evt.createdAt
      });
    }
  }

  return {
    success: true,
    count: eventsToCreate.length,
    attemptId: data.attemptId
  };
}

export async function getAttemptEvents(attemptId: string, userId: string, userRole: UserRole) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId }
  });

  if (!attempt) {
    throw new Error("Exam attempt not found");
  }

  if (userRole === UserRole.CANDIDATE && attempt.candidateId !== userId) {
    throw new Error("Access denied: You do not have permission to view these proctoring logs");
  }

  const events = await prisma.proctorEvent.findMany({
    where: { attemptId },
    orderBy: { createdAt: "asc" }
  });

  // Calculate summary counts by severity
  const severityBreakdown = events.reduce((acc: Record<string, number>, evt) => {
    acc[evt.severity] = (acc[evt.severity] || 0) + 1;
    return acc;
  }, {});

  return {
    attemptId,
    totalEvents: events.length,
    severityBreakdown,
    events
  };
}

export async function analyzeAndLogFrame(
  attemptId: string,
  candidateId: string,
  fileBuffer: Buffer,
  mimeType: string
) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      candidate: {
        select: { id: true, fullName: true, email: true }
      }
    }
  });

  if (!attempt) {
    throw new Error("Exam attempt not found");
  }

  if (attempt.candidateId !== candidateId) {
    throw new Error("Access denied: You do not own this exam attempt");
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new Error("Cannot process frame: Attempt is no longer active");
  }

  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
  formData.append("file", blob, "frame.jpg");

  let aiResult: any;
  try {
    const aiRes = await fetch(`${AI_SERVICE_URL}/api/cv/analyze-frame`, {
      method: "POST",
      body: formData
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI service responded with ${aiRes.status}: ${errText}`);
    }

    aiResult = await aiRes.json();
  } catch (error: any) {
    console.warn("Notice: Python AI microservice unreachable, skipping frame analysis:", error.message);
    return {
      faceDetected: true,
      faceCount: 1,
      lookingAway: false,
      phoneDetected: false,
      anomalies: []
    };
  }

  if (aiResult.anomalies && aiResult.anomalies.length > 0) {
    for (const anom of aiResult.anomalies) {
      const severity = (anom.severity as EventSeverity) || EventSeverity.HIGH;

      const event = await prisma.proctorEvent.create({
        data: {
          attemptId,
          eventType: anom.eventType,
          severity,
          metadata: {
            description: anom.description,
            confidence: anom.confidence,
            source: "WEBCAM",
            ...(anom.metadata ?? {})
          }
        }
      });

      broadcastExamAlert(attempt.examId, {
        attemptId: attempt.id,
        candidate: {
          id: attempt.candidate.id,
          fullName: attempt.candidate.fullName,
          email: attempt.candidate.email
        },
        eventType: anom.eventType,
        severity,
        metadata: {
          description: anom.description,
          confidence: anom.confidence,
          source: "WEBCAM"
        },
        createdAt: event.createdAt
      });

      if (severity === EventSeverity.HIGH || severity === EventSeverity.CRITICAL) {
        const filename = `evidence_${attemptId}_${Date.now()}.jpg`;
        const { filePath } = await storageService.saveEvidence(filename, fileBuffer, mimeType);

        await prisma.evidence.create({
          data: {
            attemptId,
            eventId: event.id,
            filePath,
            fileType: mimeType
          }
        });
      }
    }
  }

  return aiResult;
}

export async function analyzeAndLogScreenFrame(
  attemptId: string,
  candidateId: string,
  fileBuffer: Buffer,
  mimeType: string
) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      candidate: {
        select: { id: true, fullName: true, email: true }
      }
    }
  });

  if (!attempt) {
    throw new Error("Exam attempt not found");
  }

  if (attempt.candidateId !== candidateId) {
    throw new Error("Access denied: You do not own this exam attempt");
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new Error("Cannot process screen frame: Attempt is no longer active");
  }

  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
  formData.append("file", blob, "screen.jpg");

  let ocrResult: any;
  try {
    const ocrRes = await fetch(`${AI_SERVICE_URL}/api/ocr/analyze-screen`, {
      method: "POST",
      body: formData
    });

    if (!ocrRes.ok) {
      const errText = await ocrRes.text();
      throw new Error(`OCR service error (${ocrRes.status}): ${errText}`);
    }

    ocrResult = await ocrRes.json();
  } catch (error: any) {
    console.warn("Notice: Python OCR microservice unreachable, skipping screen text analysis:", error.message);
    return {
      hasIndicators: false,
      detectedTextSnippet: "",
      anomalies: []
    };
  }

  if (ocrResult.anomalies && ocrResult.anomalies.length > 0) {
    for (const anom of ocrResult.anomalies) {
      const severity = (anom.severity as EventSeverity) || EventSeverity.HIGH;

      const event = await prisma.proctorEvent.create({
        data: {
          attemptId,
          eventType: anom.eventType,
          severity,
          metadata: {
            description: anom.description,
            confidence: anom.confidence,
            source: "SCREEN",
            ...(anom.metadata ?? {})
          }
        }
      });

      broadcastExamAlert(attempt.examId, {
        attemptId: attempt.id,
        candidate: {
          id: attempt.candidate.id,
          fullName: attempt.candidate.fullName,
          email: attempt.candidate.email
        },
        eventType: anom.eventType,
        severity,
        metadata: {
          description: anom.description,
          confidence: anom.confidence,
          source: "SCREEN"
        },
        createdAt: event.createdAt
      });

      const filename = `screen_${attemptId}_${Date.now()}.jpg`;
      const { filePath } = await storageService.saveEvidence(filename, fileBuffer, mimeType);

      await prisma.evidence.create({
        data: {
          attemptId,
          eventId: event.id,
          filePath,
          fileType: mimeType
        }
      });
    }
  }

  return ocrResult;
}

export async function evaluateAttemptAnomaly(
  attemptId: string,
  userId?: string,
  userRole?: UserRole
) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      events: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!attempt) {
    throw new Error("Exam attempt not found");
  }

  if (userRole === UserRole.CANDIDATE && attempt.candidateId !== userId) {
    throw new Error("Access denied: You do not own this exam attempt");
  }

  // Payload for Python AI microservice
  const payload = {
    attemptId,
    events: attempt.events.map((e) => ({
      eventType: e.eventType,
      severity: e.severity,
      metadata: e.metadata,
      createdAt: e.createdAt.toISOString()
    }))
  };

  let aiRes: any;
  try {
    const res = await fetch(`${AI_SERVICE_URL}/api/anomaly/evaluate-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI anomaly service error (${res.status}): ${errText}`);
    }

    aiRes = await res.json();
  } catch (err: any) {
    console.warn("Notice: AI anomaly service unreachable, using rule baseline:", err.message);
    // Local fallback heuristic
    const highEvents = attempt.events.filter((e) => e.severity === EventSeverity.HIGH || e.severity === EventSeverity.CRITICAL).length;
    const fallbackScore = Math.min(100, highEvents * 20);
    const fallbackLevel = fallbackScore > 75 ? RiskLevel.CRITICAL : fallbackScore > 50 ? RiskLevel.HIGH : fallbackScore > 25 ? RiskLevel.MEDIUM : RiskLevel.LOW;

    aiRes = {
      score: fallbackScore,
      riskLevel: fallbackLevel,
      explanation: { note: "Local fallback anomaly evaluation", highEventCount: highEvents },
      modelVersion: "Fallback-Heuristic-v1"
    };
  }

  // Persist into anomaly_scores table
  const recordedScore = await prisma.anomalyScore.create({
    data: {
      attemptId,
      score: aiRes.score,
      riskLevel: aiRes.riskLevel as RiskLevel,
      explanation: aiRes.explanation,
      modelVersion: aiRes.modelVersion
    }
  });

  return recordedScore;
}

export async function getAttemptAnomalyScore(attemptId: string) {
  return prisma.anomalyScore.findFirst({
    where: { attemptId },
    orderBy: { createdAt: "desc" }
  });
}
