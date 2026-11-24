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
