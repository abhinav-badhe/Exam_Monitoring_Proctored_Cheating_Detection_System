import { Router } from "express";
import * as examController from "../controllers/exam.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { createExamSchema, updateExamSchema, createQuestionSchema } from "../validators/exam.validator";
import { UserRole } from "@prisma/client";

const router = Router();

// Candidate, Examiner, and Admin can list exams (with role-filtered content)
router.get("/", authenticate, examController.getExams);
router.get("/:id", authenticate, examController.getExamById);

// Examiner & Admin routes
router.post(
  "/",
  authenticate,
  authorize([UserRole.EXAMINER, UserRole.ADMIN]),
  validateBody(createExamSchema),
  examController.createExam
);

router.put(
  "/:id",
  authenticate,
  authorize([UserRole.EXAMINER, UserRole.ADMIN]),
  validateBody(updateExamSchema),
  examController.updateExam
);

router.post(
  "/:id/questions",
  authenticate,
  authorize([UserRole.EXAMINER, UserRole.ADMIN]),
  validateBody(createQuestionSchema),
  examController.addQuestion
);

router.delete(
  "/questions/:id",
  authenticate,
  authorize([UserRole.EXAMINER, UserRole.ADMIN]),
  examController.deleteQuestion
);

export default router;
