import { api } from "./api";
import { ExamAttempt, Answer } from "../types";

export const attemptService = {
  async startAttempt(examId: string): Promise<ExamAttempt> {
    const res = await api.post("/attempts", { examId });
    return res.data.data;
  },

  async getAttempt(attemptId: string): Promise<ExamAttempt> {
    const res = await api.get(`/attempts/${attemptId}`);
    return res.data.data;
  },

  async saveAnswer(
    attemptId: string,
    data: { questionId: string; selectedOptionId?: string | null; answerText?: string | null }
  ): Promise<Answer> {
    const res = await api.post(`/attempts/${attemptId}/answers`, data);
    return res.data.data;
  },

  async submitAttempt(attemptId: string): Promise<ExamAttempt> {
    const res = await api.post(`/attempts/${attemptId}/submit`);
    return res.data.data;
  },

  async getExamResults(examId: string): Promise<ExamAttempt[]> {
    const res = await api.get(`/attempts/exam/${examId}/results`);
    return res.data.data;
  },

  async getCandidateResult(attemptId: string): Promise<ExamAttempt> {
    const res = await api.get(`/attempts/${attemptId}/result`);
    return res.data.data;
  }
};
