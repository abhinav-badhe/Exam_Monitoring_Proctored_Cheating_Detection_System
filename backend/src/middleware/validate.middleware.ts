import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { sendError } from "../utils/apiResponse";

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issueMessages = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
        return sendError(res, issueMessages, 400, error.issues);
      }
      return sendError(res, "Invalid request payload", 400);
    }
  };
}
