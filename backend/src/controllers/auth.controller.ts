import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { sendSuccess, sendError } from "../utils/apiResponse";

export async function register(req: Request, res: Response) {
  try {
    const result = await authService.registerCandidate(req.body);
    return sendSuccess(res, result, "Candidate registered successfully", 201);
  } catch (error: any) {
    return sendError(res, error.message || "Registration failed", 400);
  }
}

export async function login(req: Request, res: Response) {
  try {
    const result = await authService.loginUser(req.body);
    return sendSuccess(res, result, "Logged in successfully", 200);
  } catch (error: any) {
    return sendError(res, error.message || "Invalid credentials", 401);
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    if (!req.user) {
      return sendError(res, "Not authenticated", 401);
    }
    const user = await authService.getCurrentUser(req.user.userId);
    return sendSuccess(res, user, "User profile retrieved");
  } catch (error: any) {
    return sendError(res, error.message || "Failed to retrieve user profile", 404);
  }
}
