import { prisma } from "../config/database";
import { IngestEventsInput, SingleProctorEvent } from "../validators/proctor.validator";
import { AttemptStatus, EventSeverity, UserRole } from "@prisma/client";

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
  INTERACTION_SUMMARY: EventSeverity.INFO,
  KEYBOARD_BURST: EventSeverity.LOW,
  PROLONGED_INACTIVITY: EventSeverity.MEDIUM
};

export async function ingestProctorEvents(candidateId: string, data: IngestEventsInput) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: data.attemptId }
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
