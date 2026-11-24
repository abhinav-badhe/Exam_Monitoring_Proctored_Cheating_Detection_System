import bcrypt from "bcryptjs";
import { prisma } from "./database";
import { UserRole, ExamStatus, QuestionType } from "@prisma/client";

async function seed() {
  console.log("🌱 Starting ProctorAI database seed...");

  const adminPassword = await bcrypt.hash("AdminPass@123", 12);
  const examinerPassword = await bcrypt.hash("ExaminerPass@123", 12);
  const candidatePassword = await bcrypt.hash("CandidatePass@123", 12);

  // 1. Create Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@proctorai.local" },
    update: {},
    create: {
      fullName: "System Administrator",
      email: "admin@proctorai.local",
      passwordHash: adminPassword,
      role: UserRole.ADMIN
    }
  });

  // 2. Create Examiner
  const examiner = await prisma.user.upsert({
    where: { email: "examiner@proctorai.local" },
    update: {},
    create: {
      fullName: "Dr. Sarah Mitchell",
      email: "examiner@proctorai.local",
      passwordHash: examinerPassword,
      role: UserRole.EXAMINER
    }
  });

  // 3. Create Candidate
  const candidate = await prisma.user.upsert({
    where: { email: "candidate@proctorai.local" },
    update: {},
    create: {
      fullName: "Alex Rivera",
      email: "candidate@proctorai.local",
      passwordHash: candidatePassword,
      role: UserRole.CANDIDATE
    }
  });

  console.log("✅ Users seeded:");
  console.log(`   - Admin: ${admin.email}`);
  console.log(`   - Examiner: ${examiner.email}`);
  console.log(`   - Candidate: ${candidate.email}`);

  // 4. Create Sample Published Exam
  const existingExam = await prisma.exam.findFirst({
    where: { title: "Computer Science & Algorithms Assessment" }
  });

  if (!existingExam) {
    const exam = await prisma.exam.create({
      data: {
        title: "Computer Science & Algorithms Assessment",
        description: "Official online assessment testing core data structures, complexity analysis, and software principles.",
        durationMinutes: 45,
        totalMarks: 30,
        status: ExamStatus.PUBLISHED,
        createdBy: examiner.id,
        questions: {
          create: [
            {
              questionText: "What is the worst-case time complexity of QuickSort on an array of n elements?",
              questionType: QuestionType.MCQ,
              marks: 10,
              orderNumber: 1,
              options: {
                create: [
                  { optionText: "O(n log n)", isCorrect: false },
                  { optionText: "O(n²)", isCorrect: true },
                  { optionText: "O(log n)", isCorrect: false },
                  { optionText: "O(n)", isCorrect: false }
                ]
              }
            },
            {
              questionText: "Which data structure follows the First-In, First-Out (FIFO) principle?",
              questionType: QuestionType.MCQ,
              marks: 10,
              orderNumber: 2,
              options: {
                create: [
                  { optionText: "Stack", isCorrect: false },
                  { optionText: "Queue", isCorrect: true },
                  { optionText: "Binary Search Tree", isCorrect: false },
                  { optionText: "Priority Queue", isCorrect: false }
                ]
              }
            },
            {
              questionText: "In relational databases, which property guarantees that transactions are either fully completed or rolled back?",
              questionType: QuestionType.MCQ,
              marks: 10,
              orderNumber: 3,
              options: {
                create: [
                  { optionText: "Consistency", isCorrect: false },
                  { optionText: "Isolation", isCorrect: false },
                  { optionText: "Durability", isCorrect: false },
                  { optionText: "Atomicity", isCorrect: true }
                ]
              }
            }
          ]
        }
      }
    });

    console.log(`✅ Sample Exam created: "${exam.title}" (ID: ${exam.id}) with 3 MCQ questions`);
  }

  console.log("🌱 Database seeding complete!");
}

seed()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
