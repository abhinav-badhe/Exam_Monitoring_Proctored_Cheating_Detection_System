import { Router } from "express";
import multer from "multer";
import * as proctorController from "../controllers/proctor.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { ingestEventsSchema } from "../validators/proctor.validator";
import { UserRole } from "@prisma/client";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max frame size
});

const router = Router();

// Candidate ingests batched proctor events
router.post(
  "/events",
  authenticate,
  authorize([UserRole.CANDIDATE]),
  validateBody(ingestEventsSchema),
  proctorController.ingestEvents
);

// Candidate uploads camera frame for CV analysis & anomaly detection
router.post(
  "/attempts/:attemptId/frame",
  authenticate,
  authorize([UserRole.CANDIDATE]),
  upload.single("frame"),
  proctorController.analyzeFrame
);

// Candidate uploads screen frame for OCR analysis & external tool indicator detection
router.post(
  "/attempts/:attemptId/screen-frame",
  authenticate,
  authorize([UserRole.CANDIDATE]),
  upload.single("frame"),
  proctorController.analyzeScreenFrame
);

// Examiner, Admin, or Candidate gets attempt proctor events
router.get(
  "/attempts/:attemptId/events",
  authenticate,
  proctorController.getAttemptEvents
);

// Evaluate behavioural anomaly score
router.post(
  "/attempts/:attemptId/evaluate-anomaly",
  authenticate,
  proctorController.evaluateAnomaly
);

// Admin-only FERPA/GDPR compliance data retention purge
router.post(
  "/maintenance/purge-expired",
  authenticate,
  authorize([UserRole.ADMIN]),
  proctorController.purgeRetentionData
);

export default router;
