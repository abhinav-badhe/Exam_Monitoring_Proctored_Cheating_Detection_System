import { Router } from "express";
import * as proctorController from "../controllers/proctor.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { ingestEventsSchema } from "../validators/proctor.validator";
import { UserRole } from "@prisma/client";

const router = Router();

// Candidate batches and ingests proctor events
router.post(
  "/events",
  authenticate,
  authorize([UserRole.CANDIDATE]),
  validateBody(ingestEventsSchema),
  proctorController.ingestEvents
);

// Examiner, Admin, or Candidate gets attempt proctor events
router.get(
  "/attempts/:attemptId/events",
  authenticate,
  proctorController.getAttemptEvents
);

export default router;
