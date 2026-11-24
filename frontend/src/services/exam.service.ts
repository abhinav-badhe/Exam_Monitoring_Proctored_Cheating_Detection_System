import { api } from "./api";
import { Exam, Question } from "../types";

export interface CreateExamPayload {
  title: string;
  description?: string;
  durationMinutes: number;
  startTime?: string | null;
  endTime?: string | null;
  totalMarks?: number;
}

export interface CreateQuestionPayload {
  questionText: string;
  questionType: "MCQ" | "DESCRIPTIVE";
  marks: number;
  orderNumber?: number;
  options?: {
    optionText: string;
    isCorrect: boolean;
  }[];
}

export const examService = {
  async getExams(): Promise<Exam[]> {
    const res = await api.get("/exams");
    return res.data.data;
  },

  async getExamById(id: string): Promise<Exam> {
    const res = await api.get(`/exams/${id}`);
    return res.data.data;
  },

  async createExam(data: CreateExamPayload): Promise<Exam> {
    const res = await api.post("/exams", data);
    return res.data.data;
  },

  async updateExam(id: string, data: Partial<CreateExamPayload & { status: string }>): Promise<Exam> {
    const res = await api.put(`/exams/${id}`, data);
    return res.data.data;
  },

  async addQuestion(examId: string, data: CreateQuestionPayload): Promise<Question> {
    const res = await api.post(`/exams/${examId}/questions`, data);
    return res.data.data;
  },

  async deleteQuestion(questionId: string): Promise<{ success: boolean }> {
    const res = await api.delete(`/exams/questions/${questionId}`);
    return res.data.data;
  }
};
