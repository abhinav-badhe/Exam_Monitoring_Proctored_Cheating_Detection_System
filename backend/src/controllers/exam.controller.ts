import { Request, Response } from "express";
import * as examService from "../services/exam.service";
import { sendSuccess, sendError } from "../utils/apiResponse";

export async function createExam(req: Request, res: Response) {
  try {
    const exam = await examService.createExam(req.user!.userId, req.body);
    return sendSuccess(res, exam, "Exam created successfully", 201);
  } catch (error: any) {
    return sendError(res, error.message || "Failed to create exam", 400);
  }
}

export async function getExams(req: Request, res: Response) {
  try {
    const exams = await examService.getExams(req.user!.userId, req.user!.role);
    return sendSuccess(res, exams, "Exams retrieved successfully");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to retrieve exams", 400);
  }
}

export async function getExamById(req: Request, res: Response) {
  try {
    const exam = await examService.getExamById(req.params.id as string, req.user!.role, req.user!.userId);
    return sendSuccess(res, exam, "Exam details retrieved");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to retrieve exam", 404);
  }
}

export async function updateExam(req: Request, res: Response) {
  try {
    const exam = await examService.updateExam(
      req.params.id as string,
      req.user!.userId,
      req.user!.role,
      req.body
    );
    return sendSuccess(res, exam, "Exam updated successfully");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to update exam", 400);
  }
}

export async function addQuestion(req: Request, res: Response) {
  try {
    const question = await examService.addQuestionToExam(
      req.params.id as string,
      req.user!.userId,
      req.user!.role,
      req.body
    );
    return sendSuccess(res, question, "Question added successfully", 201);
  } catch (error: any) {
    return sendError(res, error.message || "Failed to add question", 400);
  }
}

export async function deleteQuestion(req: Request, res: Response) {
  try {
    const result = await examService.deleteQuestion(
      req.params.id as string,
      req.user!.userId,
      req.user!.role
    );
    return sendSuccess(res, result, "Question deleted successfully");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to delete question", 400);
  }
}
