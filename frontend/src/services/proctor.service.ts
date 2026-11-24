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

export interface CVAnalysisResult {
  faceDetected: boolean;
  faceCount: number;
  lookingAway: boolean;
  headPose?: {
    yaw: number;
    pitch: number;
    roll: number;
  };
  phoneDetected: boolean;
  phoneConfidence: number;
  anomalies: Array<{
    eventType: string;
    severity: string;
    description: string;
    confidence: number;
    metadata?: Record<string, any>;
  }>;
  processedTimestamp: string;
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
  },

  async analyzeFrame(attemptId: string, imageBlob: Blob): Promise<CVAnalysisResult> {
    const formData = new FormData();
    formData.append("frame", imageBlob, "frame.jpg");

    const res = await api.post(`/proctor/attempts/${attemptId}/frame`, formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return res.data.data;
  },

  async analyzeScreenFrame(attemptId: string, imageBlob: Blob): Promise<{
    hasIndicators: boolean;
    detectedTextSnippet: string;
    anomalies: Array<{
      eventType: string;
      severity: string;
      description: string;
      confidence: number;
      metadata?: Record<string, any>;
    }>;
  }> {
    const formData = new FormData();
    formData.append("frame", imageBlob, "screen.jpg");

    const res = await api.post(`/proctor/attempts/${attemptId}/screen-frame`, formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return res.data.data;
  },

  async evaluateAttemptAnomaly(attemptId: string): Promise<any> {
    const res = await api.post(`/proctor/attempts/${attemptId}/evaluate-anomaly`);
    return res.data.data;
  },

  async warnCandidate(attemptId: string, warningMessage: string) {
    const res = await api.post(`/proctor/attempts/${attemptId}/warn`, { warningMessage });
    return res.data.data;
  },

  async freezeAttempt(attemptId: string, reason?: string) {
    const res = await api.post(`/proctor/attempts/${attemptId}/freeze`, { reason });
    return res.data.data;
  },

  async unfreezeAttempt(attemptId: string) {
    const res = await api.post(`/proctor/attempts/${attemptId}/unfreeze`);
    return res.data.data;
  },

  async forceSubmitAttempt(attemptId: string, reason: string, disqualify: boolean = false) {
    const res = await api.post(`/proctor/attempts/${attemptId}/force-submit`, { reason, disqualify });
    return res.data.data;
  }
};
