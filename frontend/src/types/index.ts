export type UserRole = "ADMIN" | "EXAMINER" | "CANDIDATE";

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export type ExamStatus = "DRAFT" | "PUBLISHED" | "COMPLETED" | "ARCHIVED";
export type QuestionType = "MCQ" | "DESCRIPTIVE";
export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED" | "EVALUATED";

export interface Option {
  id: string;
  questionId?: string;
  optionText: string;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  examId: string;
  questionText: string;
  questionType: QuestionType;
  marks: number;
  orderNumber: number;
  options: Option[];
}

export interface Exam {
  id: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  startTime?: string | null;
  endTime?: string | null;
  status: ExamStatus;
  totalMarks: number;
  createdBy: string;
  createdAt: string;
  creator?: {
    fullName: string;
    email?: string;
  };
  questions?: Question[];
  _count?: {
    questions: number;
    attempts: number;
  };
}

export interface Answer {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOptionId?: string | null;
  answerText?: string | null;
  marksAwarded?: number | null;
  question?: Question;
  selectedOption?: Option;
}

export interface AnomalyScore {
  id: string;
  attemptId: string;
  score: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  explanation?: any;
  modelVersion?: string;
  createdAt: string;
}

export interface ReviewRecord {
  id: string;
  attemptId: string;
  reviewerId: string;
  decision: "CLEARED" | "FLAGGED_FOR_INQUIRY" | "DISQUALIFIED" | string;
  notes?: string | null;
  createdAt: string;
  reviewer?: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface ExamAttempt {
  id: string;
  examId: string;
  candidateId: string;
  startedAt: string;
  submittedAt?: string | null;
  status: AttemptStatus;
  totalScore?: number | null;
  remainingSeconds?: number;
  isFrozen?: boolean;
  frozenReason?: string | null;
  exam: Exam;
  answers: Answer[];
  candidate?: User;
  scores?: AnomalyScore[];
  reviews?: ReviewRecord[];
}
