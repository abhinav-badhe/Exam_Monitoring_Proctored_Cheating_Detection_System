import { Request, Response } from "express";
import * as attemptService from "../services/attempt.service";
import { sendSuccess, sendError } from "../utils/apiResponse";

export async function startAttempt(req: Request, res: Response) {
  try {
    const attempt = await attemptService.startAttempt(req.user!.userId, req.body.examId);
    return sendSuccess(res, attempt, "Exam attempt initialized", 201);
  } catch (error: any) {
    return sendError(res, error.message || "Failed to start exam attempt", 400);
  }
}

export async function getAttempt(req: Request, res: Response) {
  try {
    const attempt = await attemptService.getAttempt(
      req.params.id as string,
      req.user!.userId,
      req.user!.role
    );
    return sendSuccess(res, attempt, "Attempt retrieved");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to retrieve attempt", 404);
  }
}

export async function saveAnswer(req: Request, res: Response) {
  try {
    const answer = await attemptService.saveAnswer(
      req.params.id as string,
      req.user!.userId,
      req.body
    );
    return sendSuccess(res, answer, "Answer recorded");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to save answer", 400);
  }
}

export async function submitAttempt(req: Request, res: Response) {
  try {
    const result = await attemptService.submitAttempt(
      req.params.id as string,
      req.user!.userId
    );
    return sendSuccess(res, result, "Exam submitted successfully");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to submit exam", 400);
  }
}

export async function getExamResults(req: Request, res: Response) {
  try {
    const results = await attemptService.getExamResults(
      req.params.examId as string,
      req.user!.userId,
      req.user!.role
    );
    return sendSuccess(res, results, "Exam results retrieved");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to retrieve results", 400);
  }
}

export async function getCandidateResult(req: Request, res: Response) {
  try {
    const result = await attemptService.getCandidateResult(
      req.params.id as string,
      req.user!.userId
    );
    return sendSuccess(res, result, "Attempt result retrieved");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to retrieve result", 404);
  }
}

export async function createReview(req: Request, res: Response) {
  try {
    const { decision, notes } = req.body;
    if (!decision) {
      return sendError(res, "Review decision is required", 400);
    }

    const review = await attemptService.createReviewRecord(
      req.params.id as string,
      req.user!.userId,
      decision,
      notes
    );
    return sendSuccess(res, review, "Review decision recorded successfully", 201);
  } catch (error: any) {
    return sendError(res, error.message || "Failed to record review", 400);
  }
}

export async function getAttemptReviews(req: Request, res: Response) {
  try {
    const reviews = await attemptService.getAttemptReviews(req.params.id as string);
    return sendSuccess(res, reviews, "Attempt reviews retrieved successfully");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to retrieve reviews", 400);
  }
}
