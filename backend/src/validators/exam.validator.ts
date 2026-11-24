import { z } from "zod";
import { ExamStatus, QuestionType } from "@prisma/client";

export const createExamSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive("Duration must be a positive integer"),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  totalMarks: z.number().nonnegative().optional().default(0)
});

export const updateExamSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  durationMinutes: z.number().int().positive().optional(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  status: z.nativeEnum(ExamStatus).optional(),
  totalMarks: z.number().nonnegative().optional()
});

export const createQuestionSchema = z.object({
  questionText: z.string().min(3, "Question text must be at least 3 characters"),
  questionType: z.nativeEnum(QuestionType),
  marks: z.number().positive("Marks must be positive").default(1),
  orderNumber: z.number().int().nonnegative().optional(),
  options: z.array(
    z.object({
      optionText: z.string().min(1, "Option text cannot be empty"),
      isCorrect: z.boolean().default(false)
    })
  ).optional()
}).refine((data) => {
  if (data.questionType === QuestionType.MCQ) {
    if (!data.options || data.options.length < 2) {
      return false;
    }
    const hasCorrect = data.options.some((o) => o.isCorrect === true);
    return hasCorrect;
  }
  return true;
}, {
  message: "MCQ questions must have at least 2 options and at least 1 correct option"
});

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
