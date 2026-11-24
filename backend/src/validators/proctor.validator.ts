import { z } from "zod";
import { EventSeverity } from "@prisma/client";

export const singleProctorEventSchema = z.object({
  eventType: z.string().min(1, "Event type is required"),
  severity: z.nativeEnum(EventSeverity).optional().default(EventSeverity.INFO),
  metadata: z.record(z.string(), z.any()).optional().default({}),
  timestamp: z.string().datetime().optional()
});

export const ingestEventsSchema = z.object({
  attemptId: z.string().uuid("Invalid attempt ID"),
  events: z.array(singleProctorEventSchema).min(1, "At least one event is required")
});

export type IngestEventsInput = z.infer<typeof ingestEventsSchema>;
export type SingleProctorEvent = z.infer<typeof singleProctorEventSchema>;
