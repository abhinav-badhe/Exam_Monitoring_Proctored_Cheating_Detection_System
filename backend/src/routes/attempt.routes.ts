import { Router } from "express";
import * as attemptController from "../controllers/attempt.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { startAttemptSchema, saveAnswerSchema } from "../validators/attempt.validator";
import { UserRole } from "@prisma/client";

const router = Router();

// Candidate starts attempt
router.post(
  "/",
  authenticate,
  authorize([UserRole.CANDIDATE]),
  validateBody(startAttemptSchema),
  attemptController.startAttempt
);

// Get attempt details
router.get("/:id", authenticate, attemptController.getAttempt);

// Save / Autosave answer
router.post(
  "/:id/answers",
  authenticate,
  authorize([UserRole.CANDIDATE]),
  validateBody(saveAnswerSchema),
  attemptController.saveAnswer
);

// Submit attempt
router.post(
  "/:id/submit",
  authenticate,
  authorize([UserRole.CANDIDATE]),
  attemptController.submitAttempt
);

// Candidate gets single attempt result
router.get(
  "/:id/result",
  authenticate,
  authorize([UserRole.CANDIDATE]),
  attemptController.getCandidateResult
);

// Examiner gets all attempts and results for an exam
router.get(
  "/exam/:examId/results",
  authenticate,
  authorize([UserRole.EXAMINER, UserRole.ADMIN]),
  attemptController.getExamResults
);

export default router;
