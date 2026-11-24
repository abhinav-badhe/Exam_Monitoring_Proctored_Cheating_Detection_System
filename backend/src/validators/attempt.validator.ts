import { z } from "zod";

export const startAttemptSchema = z.object({
  examId: z.string().uuid("Invalid exam ID")
});

export const saveAnswerSchema = z.object({
  questionId: z.string().uuid("Invalid question ID"),
  selectedOptionId: z.string().uuid("Invalid option ID").optional().nullable(),
  answerText: z.string().optional().nullable()
});

export type StartAttemptInput = z.infer<typeof startAttemptSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
