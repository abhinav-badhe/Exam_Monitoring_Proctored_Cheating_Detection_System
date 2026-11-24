import { api } from "./api";

export interface ProctorEventPayload {
  eventType: string;
  severity?: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface ProctorEventsResponse {
  attemptId: string;
  totalEvents: number;
  severityBreakdown: Record<string, number>;
  events: Array<{
    id: string;
    attemptId: string;
    eventType: string;
    severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    metadata: Record<string, any>;
    createdAt: string;
  }>;
}

export const proctorService = {
  async ingestEvents(attemptId: string, events: ProctorEventPayload[]) {
    if (events.length === 0) return;
    const res = await api.post("/proctor/events", {
      attemptId,
      events
    });
    return res.data.data;
  },

  async getAttemptEvents(attemptId: string): Promise<ProctorEventsResponse> {
    const res = await api.get(`/proctor/attempts/${attemptId}/events`);
    return res.data.data;
  }
};
