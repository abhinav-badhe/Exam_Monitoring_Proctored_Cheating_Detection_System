import { prisma } from "../config/database";
import { SaveAnswerInput } from "../validators/attempt.validator";
import { AttemptStatus, ExamStatus, QuestionType, UserRole } from "@prisma/client";
import { evaluateAttemptAnomaly } from "./proctor.service";

export async function startAttempt(candidateId: string, examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId }
  });

  if (!exam) {
    throw new Error("Exam not found");
  }

  if (exam.status !== ExamStatus.PUBLISHED) {
    throw new Error("Exam is not active or available for taking");
  }

  // Check if candidate already has an attempt
  const existingAttempt = await prisma.examAttempt.findUnique({
    where: {
      examId_candidateId: {
        examId,
        candidateId
      }
    }
  });

  if (existingAttempt) {
    if (existingAttempt.status === AttemptStatus.IN_PROGRESS) {
      // Check if time expired
      const elapsedMinutes = (Date.now() - new Date(existingAttempt.startedAt).getTime()) / (1000 * 60);
      if (elapsedMinutes > exam.durationMinutes) {
        // Auto submit if expired
        return autoSubmitAttempt(existingAttempt.id);
      }
      return existingAttempt;
    } else {
      throw new Error("You have already submitted this exam");
    }
  }

  return prisma.examAttempt.create({
    data: {
      examId,
      candidateId,
      startedAt: new Date(),
      status: AttemptStatus.IN_PROGRESS
    }
  });
}

export async function getAttempt(attemptId: string, userId: string, userRole: UserRole) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          questions: {
            orderBy: { orderNumber: "asc" },
            include: {
              options: {
                select: {
                  id: true,
                  optionText: true,
                  isCorrect: userRole !== UserRole.CANDIDATE // sanitize for candidate
                }
              }
            }
          }
        }
      },
      answers: true,
      candidate: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    }
  });

  if (!attempt) {
    throw new Error("Attempt not found");
  }

  if (userRole === UserRole.CANDIDATE && attempt.candidateId !== userId) {
    throw new Error("Access denied: You do not own this exam attempt");
  }

  // Compute remaining seconds
  const startTime = new Date(attempt.startedAt).getTime();
  const maxEndTime = startTime + attempt.exam.durationMinutes * 60 * 1000;
  const remainingSeconds = Math.max(0, Math.floor((maxEndTime - Date.now()) / 1000));

  return {
    ...attempt,
    remainingSeconds
  };
}

export async function saveAnswer(attemptId: string, candidateId: string, data: SaveAnswerInput) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId }
  });

  if (!attempt) {
    throw new Error("Attempt not found");
  }

  if (attempt.candidateId !== candidateId) {
    throw new Error("Access denied: You do not own this attempt");
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new Error("Cannot save answer: Exam attempt is already submitted or closed");
  }

  return prisma.answer.upsert({
    where: {
      attemptId_questionId: {
        attemptId,
        questionId: data.questionId
      }
    },
    update: {
      selectedOptionId: data.selectedOptionId ?? null,
      answerText: data.answerText ?? null
    },
    create: {
      attemptId,
      questionId: data.questionId,
      selectedOptionId: data.selectedOptionId ?? null,
      answerText: data.answerText ?? null
    }
  });
}

export async function submitAttempt(attemptId: string, candidateId: string) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          questions: {
            include: {
              options: true
            }
          }
        }
      },
      answers: true
    }
  });

  if (!attempt) {
    throw new Error("Attempt not found");
  }

  if (attempt.candidateId !== candidateId) {
    throw new Error("Access denied: You do not own this attempt");
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new Error("Attempt is already submitted");
  }

  return calculateAndFinalizeScore(attempt, AttemptStatus.SUBMITTED);
}

export async function autoSubmitAttempt(attemptId: string) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          questions: {
            include: {
              options: true
            }
          }
        }
      },
      answers: true
    }
  });

  if (!attempt || attempt.status !== AttemptStatus.IN_PROGRESS) {
    return attempt;
  }

  return calculateAndFinalizeScore(attempt, AttemptStatus.AUTO_SUBMITTED);
}

async function calculateAndFinalizeScore(attempt: any, finalStatus: AttemptStatus) {
  let totalScore = 0;

  for (const question of attempt.exam.questions) {
    const candidateAnswer = attempt.answers.find((a: any) => a.questionId === question.id);

    if (question.questionType === QuestionType.MCQ) {
      if (candidateAnswer && candidateAnswer.selectedOptionId) {
        const selectedOption = question.options.find(
          (opt: any) => opt.id === candidateAnswer.selectedOptionId
        );

        if (selectedOption && selectedOption.isCorrect) {
          const marks = question.marks;
          totalScore += marks;
          await prisma.answer.update({
            where: { id: candidateAnswer.id },
            data: { marksAwarded: marks }
          });
        } else {
          await prisma.answer.update({
            where: { id: candidateAnswer.id },
            data: { marksAwarded: 0 }
          });
        }
      }
    }
  }

  const finalizedAttempt = await prisma.examAttempt.update({
    where: { id: attempt.id },
    data: {
      status: finalStatus,
      submittedAt: new Date(),
      totalScore
    },
    include: {
      answers: true,
      exam: true,
      scores: true
    }
  });

  // Automatically trigger behavioural anomaly evaluation
  try {
    await evaluateAttemptAnomaly(attempt.id);
  } catch (err: any) {
    console.warn("Notice: Anomaly evaluation deferred or backgrounded:", err.message);
  }

  return finalizedAttempt;
}

export async function getExamResults(examId: string, examinerId: string, userRole: UserRole) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId }
  });

  if (!exam) {
    throw new Error("Exam not found");
  }

  if (userRole !== UserRole.ADMIN && exam.createdBy !== examinerId) {
    throw new Error("Access denied: You do not have permission to view results for this exam");
  }

  return prisma.examAttempt.findMany({
    where: { examId },
    include: {
      candidate: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      },
      scores: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          reviewer: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      },
      _count: {
        select: {
          events: true,
          scores: true
        }
      }
    },
    orderBy: { submittedAt: "desc" }
  });
}

export async function createReviewRecord(
  attemptId: string,
  reviewerId: string,
  decision: "CLEARED" | "FLAGGED_FOR_INQUIRY" | "DISQUALIFIED",
  notes?: string
) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId }
  });

  if (!attempt) {
    throw new Error("Exam attempt not found");
  }

  const validDecisions = ["CLEARED", "FLAGGED_FOR_INQUIRY", "DISQUALIFIED"];
  if (!validDecisions.includes(decision)) {
    throw new Error(`Invalid review decision. Must be one of: ${validDecisions.join(", ")}`);
  }

  return prisma.reviewRecord.create({
    data: {
      attemptId,
      reviewerId,
      decision,
      notes: notes || null
    },
    include: {
      reviewer: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    }
  });
}

export async function getAttemptReviews(attemptId: string) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId }
  });

  if (!attempt) {
    throw new Error("Exam attempt not found");
  }

  return prisma.reviewRecord.findMany({
    where: { attemptId },
    include: {
      reviewer: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getCandidateResult(attemptId: string, candidateId: string) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        select: {
          id: true,
          title: true,
          description: true,
          totalMarks: true,
          durationMinutes: true
        }
      },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              questionText: true,
              questionType: true,
              marks: true,
              options: {
                select: {
                  id: true,
                  optionText: true,
                  isCorrect: true // Candidate can see what was correct AFTER submission
                }
              }
            }
          },
          selectedOption: true
        }
      }
    }
  });

  if (!attempt) {
    throw new Error("Result not found");
  }

  if (attempt.candidateId !== candidateId) {
    throw new Error("Access denied: You do not own this attempt");
  }

  return attempt;
}
