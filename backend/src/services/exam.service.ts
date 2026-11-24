import { prisma } from "../config/database";
import { CreateExamInput, UpdateExamInput, CreateQuestionInput } from "../validators/exam.validator";
import { ExamStatus, QuestionType, UserRole } from "@prisma/client";

export async function createExam(examinerId: string, data: CreateExamInput) {
  return prisma.exam.create({
    data: {
      title: data.title,
      description: data.description,
      durationMinutes: data.durationMinutes,
      startTime: data.startTime ? new Date(data.startTime) : null,
      endTime: data.endTime ? new Date(data.endTime) : null,
      totalMarks: data.totalMarks ?? 0,
      createdBy: examinerId,
      status: ExamStatus.DRAFT
    },
    include: {
      creator: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    }
  });
}

export async function getExams(userId: string, role: UserRole) {
  if (role === UserRole.CANDIDATE) {
    return prisma.exam.findMany({
      where: {
        status: {
          in: [ExamStatus.PUBLISHED, ExamStatus.COMPLETED]
        }
      },
      include: {
        creator: {
          select: {
            fullName: true
          }
        },
        _count: {
          select: {
            questions: true,
            attempts: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  // Admin or Examiner
  const whereClause = role === UserRole.ADMIN ? {} : { createdBy: userId };
  return prisma.exam.findMany({
    where: whereClause,
    include: {
      creator: {
        select: {
          fullName: true,
          email: true
        }
      },
      _count: {
        select: {
          questions: true,
          attempts: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getExamById(examId: string, userRole: UserRole, userId: string) {
  const isCandidate = userRole === UserRole.CANDIDATE;

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      creator: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      },
      questions: {
        orderBy: { orderNumber: "asc" },
        include: {
          options: {
            select: {
              id: true,
              optionText: true,
              isCorrect: !isCandidate // IMPORTANT: Never send isCorrect to candidate
            }
          }
        }
      },
      _count: {
        select: {
          attempts: true
        }
      }
    }
  });

  if (!exam) {
    throw new Error("Exam not found");
  }

  if (isCandidate && exam.status === ExamStatus.DRAFT) {
    throw new Error("This exam is not yet available");
  }

  return exam;
}

export async function updateExam(examId: string, userId: string, userRole: UserRole, data: UpdateExamInput) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    throw new Error("Exam not found");
  }

  if (userRole !== UserRole.ADMIN && exam.createdBy !== userId) {
    throw new Error("You do not have permission to modify this exam");
  }

  return prisma.exam.update({
    where: { id: examId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.durationMinutes && { durationMinutes: data.durationMinutes }),
      ...(data.startTime !== undefined && { startTime: data.startTime ? new Date(data.startTime) : null }),
      ...(data.endTime !== undefined && { endTime: data.endTime ? new Date(data.endTime) : null }),
      ...(data.status && { status: data.status }),
      ...(data.totalMarks !== undefined && { totalMarks: data.totalMarks })
    }
  });
}

export async function addQuestionToExam(examId: string, userId: string, userRole: UserRole, data: CreateQuestionInput) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) {
    throw new Error("Exam not found");
  }

  if (userRole !== UserRole.ADMIN && exam.createdBy !== userId) {
    throw new Error("You do not have permission to add questions to this exam");
  }

  // Determine order number if not passed
  let orderNumber = data.orderNumber;
  if (orderNumber === undefined) {
    const lastQuestion = await prisma.question.findFirst({
      where: { examId },
      orderBy: { orderNumber: "desc" }
    });
    orderNumber = lastQuestion ? lastQuestion.orderNumber + 1 : 1;
  }

  const question = await prisma.question.create({
    data: {
      examId,
      questionText: data.questionText,
      questionType: data.questionType,
      marks: data.marks,
      orderNumber,
      options: data.options && data.options.length > 0 ? {
        create: data.options.map((opt) => ({
          optionText: opt.optionText,
          isCorrect: opt.isCorrect ?? false
        }))
      } : undefined
    },
    include: {
      options: true
    }
  });

  // Automatically update exam totalMarks
  const total = await prisma.question.aggregate({
    where: { examId },
    _sum: { marks: true }
  });

  await prisma.exam.update({
    where: { id: examId },
    data: { totalMarks: total._sum.marks || 0 }
  });

  return question;
}

export async function deleteQuestion(questionId: string, userId: string, userRole: UserRole) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { exam: true }
  });

  if (!question) {
    throw new Error("Question not found");
  }

  if (userRole !== UserRole.ADMIN && question.exam.createdBy !== userId) {
    throw new Error("You do not have permission to delete this question");
  }

  await prisma.question.delete({ where: { id: questionId } });

  // Recalculate total marks
  const total = await prisma.question.aggregate({
    where: { examId: question.examId },
    _sum: { marks: true }
  });

  await prisma.exam.update({
    where: { id: question.examId },
    data: { totalMarks: total._sum.marks || 0 }
  });

  return { success: true };
}
