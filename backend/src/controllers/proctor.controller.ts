import { Request, Response } from "express";
import * as proctorService from "../services/proctor.service";
import { sendSuccess, sendError } from "../utils/apiResponse";

export async function ingestEvents(req: Request, res: Response) {
  try {
    const result = await proctorService.ingestProctorEvents(req.user!.userId, req.body);
    return sendSuccess(res, result, "Proctor events ingested successfully", 201);
  } catch (error: any) {
    return sendError(res, error.message || "Failed to ingest proctor events", 400);
  }
}

export async function getAttemptEvents(req: Request, res: Response) {
  try {
    const result = await proctorService.getAttemptEvents(
      req.params.attemptId as string,
      req.user!.userId,
      req.user!.role
    );
    return sendSuccess(res, result, "Proctor events retrieved successfully");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to retrieve proctor events", 400);
  }
}

export async function analyzeFrame(req: Request, res: Response) {
  try {
    if (!req.file) {
      return sendError(res, "No frame image provided", 400);
    }

    const result = await proctorService.analyzeAndLogFrame(
      req.params.attemptId as string,
      req.user!.userId,
      req.file.buffer,
      req.file.mimetype
    );

    return sendSuccess(res, result, "Frame analyzed successfully");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to analyze frame", 400);
  }
}

export async function analyzeScreenFrame(req: Request, res: Response) {
  try {
    if (!req.file) {
      return sendError(res, "No screen frame image provided", 400);
    }

    const result = await proctorService.analyzeAndLogScreenFrame(
      req.params.attemptId as string,
      req.user!.userId,
      req.file.buffer,
      req.file.mimetype
    );

    return sendSuccess(res, result, "Screen frame analyzed successfully");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to analyze screen frame", 400);
  }
}

export async function evaluateAnomaly(req: Request, res: Response) {
  try {
    const result = await proctorService.evaluateAttemptAnomaly(
      req.params.attemptId as string,
      req.user!.userId,
      req.user!.role
    );
    return sendSuccess(res, result, "Attempt anomaly evaluation completed");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to evaluate anomaly", 400);
  }
}

export async function purgeRetentionData(req: Request, res: Response) {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
    const { storageService } = await import("../services/storage.service");
    const result = await storageService.purgeExpiredEvidence(days);
    return sendSuccess(res, result, "FERPA/GDPR compliance data purge executed successfully");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to execute compliance purge", 500);
  }
}

export async function warnCandidate(req: Request, res: Response) {
  try {
    const { warningMessage } = req.body;
    if (!warningMessage || !warningMessage.trim()) {
      return sendError(res, "Warning message is required", 400);
    }
    const result = await proctorService.issueExaminerWarning(
      req.params.attemptId as string,
      req.user!.userId,
      warningMessage.trim()
    );
    return sendSuccess(res, result, "Direct warning dispatched to candidate", 200);
  } catch (error: any) {
    return sendError(res, error.message || "Failed to dispatch warning", 400);
  }
}

export async function freezeAttempt(req: Request, res: Response) {
  try {
    const { reason } = req.body;
    const result = await proctorService.freezeAttempt(
      req.params.attemptId as string,
      req.user!.userId,
      reason
    );
    return sendSuccess(res, result, "Examination attempt successfully frozen", 200);
  } catch (error: any) {
    return sendError(res, error.message || "Failed to freeze exam attempt", 400);
  }
}

export async function unfreezeAttempt(req: Request, res: Response) {
  try {
    const result = await proctorService.unfreezeAttempt(
      req.params.attemptId as string,
      req.user!.userId
    );
    return sendSuccess(res, result, "Examination attempt successfully resumed", 200);
  } catch (error: any) {
    return sendError(res, error.message || "Failed to resume exam attempt", 400);
  }
}

export async function forceSubmitAttempt(req: Request, res: Response) {
  try {
    const { reason, disqualify } = req.body;
    if (!reason || !reason.trim()) {
      return sendError(res, "Reason for force termination is required", 400);
    }
    const result = await proctorService.forceSubmitAttempt(
      req.params.attemptId as string,
      req.user!.userId,
      reason.trim(),
      !!disqualify
    );
    return sendSuccess(res, result, "Examination attempt terminated by proctor", 200);
  } catch (error: any) {
    return sendError(res, error.message || "Failed to force-submit exam attempt", 400);
  }
}
