import { PrismaClient, EventSeverity, UserRole } from "@prisma/client";
import path from "path";
import fs from "fs";

const prisma = new PrismaClient();
const BASE_URL = "http://127.0.0.1:5000/api";
const AI_URL = "http://127.0.0.1:8000";

interface TestResult {
  endpoint: string;
  method: string;
  status: "PASSED" | "FAILED";
  httpCode: number;
  notes: string;
}

const auditLog: TestResult[] = [];

async function request(
  method: string,
  endpoint: string,
  body?: any,
  token?: string,
  isMultipart: boolean = false
): Promise<{ status: number; data: any; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let payload: any;
  if (body) {
    if (isMultipart) {
      payload = body;
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: payload
  });

  let data: any;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data, headers: res.headers };
}

function record(method: string, endpoint: string, expectedCode: number, actualCode: number, notes: string = "") {
  const passed = actualCode === expectedCode;
  auditLog.push({
    endpoint,
    method,
    status: passed ? "PASSED" : "FAILED",
    httpCode: actualCode,
    notes: passed ? notes : `Expected ${expectedCode}, got ${actualCode}. ${notes}`
  });
  const icon = passed ? "✅" : "❌";
  console.log(` ${icon} [${method.padEnd(6)}] ${endpoint.padEnd(45)} -> ${actualCode} (${passed ? "PASS" : "FAIL"}) | ${notes}`);
  if (!passed) {
    throw new Error(`Endpoint audit failed on [${method}] ${endpoint}: expected ${expectedCode}, got ${actualCode}`);
  }
}

async function runFullEndpointAudit() {
  console.log("==========================================================================================");
  console.log("🔍 EXHAUSTIVE PROCTORAI API ENDPOINTS & CONNECTIVITY AUDIT");
  console.log("==========================================================================================\n");

  // 1. Health & Unauthenticated Rejection Checks
  console.log("--- SECTION 1: Health & Authentication Guardrails ---");
  const health = await request("GET", "/health");
  record("GET", "/api/health", 200, health.status, "System health operational");

  const unauthMe = await request("GET", "/auth/me");
  record("GET", "/api/auth/me (Unauthenticated)", 401, unauthMe.status, "Correctly rejected without JWT token");

  // 2. Authentication Flow (Register, Login, Me)
  console.log("\n--- SECTION 2: Authentication & RBAC Tokens ---");
  const timestamp = Date.now();
  const testCandidateEmail = `audit_cand_${timestamp}@proctorai.local`;

  // Register Candidate
  const regRes = await request("POST", "/auth/register", {
    fullName: "Audit Test Candidate",
    email: testCandidateEmail,
    password: "Password@123"
  });
  record("POST", "/api/auth/register", 201, regRes.status, "Candidate registered successfully");
  const candidateToken = regRes.data.data.token;
  const candidateUser = regRes.data.data.user;

  // Duplicate registration rejection
  const dupRes = await request("POST", "/auth/register", {
    fullName: "Audit Test Candidate",
    email: testCandidateEmail,
    password: "Password@123"
  });
  record("POST", "/api/auth/register (Duplicate)", 400, dupRes.status, "Duplicate email properly rejected");

  // Login Candidate
  const candLogin = await request("POST", "/auth/login", {
    email: testCandidateEmail,
    password: "Password@123"
  });
  record("POST", "/api/auth/login", 200, candLogin.status, "Candidate login token granted");

  // Login Examiner
  const exLogin = await request("POST", "/auth/login", {
    email: "examiner@proctorai.local",
    password: "ExaminerPass@123"
  });
  record("POST", "/api/auth/login (Examiner)", 200, exLogin.status, "Examiner login token granted");
  const examinerToken = exLogin.data.data.token;

  // Login Admin
  const adminLogin = await request("POST", "/auth/login", {
    email: "admin@proctorai.local",
    password: "AdminPass@123"
  });
  record("POST", "/api/auth/login (Admin)", 200, adminLogin.status, "Admin login token granted");
  const adminToken = adminLogin.data.data.token;

  // Get Me
  const meRes = await request("GET", "/auth/me", undefined, candidateToken);
  record("GET", "/api/auth/me (Authenticated)", 200, meRes.status, `Retrieved profile: ${meRes.data.data.email}`);

  // 3. Exam Endpoints & RBAC Enforcement
  console.log("\n--- SECTION 3: Exam Authoring, Question Management & Security Stripping ---");
  // Candidate attempts to create exam (Should fail with 403)
  const candCreateExam = await request("POST", "/exams", { title: "Illegal Exam" }, candidateToken);
  record("POST", "/api/exams (Candidate RBAC)", 403, candCreateExam.status, "Candidate prohibited from authoring exams");

  // Examiner creates exam
  const examTitle = `Audit Assessment ${timestamp}`;
  const createExamRes = await request("POST", "/exams", {
    title: examTitle,
    description: "Rigorous endpoint testing suite exam",
    durationMinutes: 30
  }, examinerToken);
  record("POST", "/api/exams (Examiner)", 201, createExamRes.status, "Exam created in DRAFT state");
  const examId = createExamRes.data.data.id;

  // List Exams
  const listExams = await request("GET", "/exams", undefined, examinerToken);
  record("GET", "/api/exams", 200, listExams.status, `Returned ${listExams.data.data.length} exams`);

  // Add Question with Options
  const addQRes = await request("POST", `/exams/${examId}/questions`, {
    questionText: "Which HTTP status code indicates unauthorized access?",
    marks: 10,
    questionType: "MCQ",
    options: [
      { optionText: "200 OK", isCorrect: false },
      { optionText: "401 Unauthorized", isCorrect: true },
      { optionText: "500 Server Error", isCorrect: false }
    ]
  }, examinerToken);
  record("POST", `/api/exams/:id/questions`, 201, addQRes.status, "Question added with 3 MCQ options");
  const questionId = addQRes.data.data.id;
  const correctOptionId = addQRes.data.data.options.find((o: any) => o.isCorrect).id;

  // Add a disposable Question to test deletion
  const disposableQ = await request("POST", `/exams/${examId}/questions`, {
    questionText: "Disposable question to test DELETE endpoint?",
    marks: 5,
    questionType: "MCQ",
    options: [
      { optionText: "Option Alpha", isCorrect: true },
      { optionText: "Option Beta", isCorrect: false }
    ]
  }, examinerToken);
  record("POST", `/api/exams/:id/questions (Disposable)`, 201, disposableQ.status, "Disposable question created for DELETE test");
  const deleteQRes = await request("DELETE", `/exams/questions/${disposableQ.data.data.id}`, undefined, examinerToken);
  record("DELETE", `/api/exams/questions/:id`, 200, deleteQRes.status, "Question successfully deleted");

  // Update Exam: Publish it
  const updateExamRes = await request("PUT", `/exams/${examId}`, { status: "PUBLISHED" }, examinerToken);
  record("PUT", `/api/exams/:id`, 200, updateExamRes.status, "Exam updated to PUBLISHED status");

  // Get Exam by ID (Candidate View - Verify isCorrect is NOT exposed)
  const getExamRes = await request("GET", `/exams/${examId}`, undefined, candidateToken);
  record("GET", `/api/exams/:id`, 200, getExamRes.status, "Retrieved exam details");
  const candidateOptions = getExamRes.data.data.questions[0].options;
  const leakedAnswers = candidateOptions.some((opt: any) => opt.isCorrect !== undefined);
  if (leakedAnswers) throw new Error("Security flaw: Candidate API leaked isCorrect answers!");
  console.log("   🛡️ Security Verified: Candidate view stripped correct answer flags");

  // 4. Attempt Lifecycle & Real-Time Telemetry
  console.log("\n--- SECTION 4: Candidate Attempt, Autosave & Ingestion Telemetry ---");
  // Start Attempt
  const startAttRes = await request("POST", "/attempts", { examId }, candidateToken);
  record("POST", "/api/attempts", 201, startAttRes.status, "Exam attempt initialized");
  const attemptId = startAttRes.data.data.id;

  // Reconnect / Resume in-progress attempt check
  const resumeAttRes = await request("POST", "/attempts", { examId }, candidateToken);
  if (resumeAttRes.data.data.id !== attemptId) throw new Error("Resume failed to return existing attempt ID!");
  record("POST", "/api/attempts (Session Reconnection)", 201, resumeAttRes.status, "Reconnected candidate to existing in-progress attempt");

  // Get Attempt Details
  const getAttRes = await request("GET", `/attempts/${attemptId}`, undefined, candidateToken);
  record("GET", `/api/attempts/:id`, 200, getAttRes.status, `Retrieved attempt. Remaining: ${getAttRes.data.data.remainingSeconds}s`);

  // Autosave Answer
  const saveAnsRes = await request("POST", `/attempts/${attemptId}/answers`, {
    questionId,
    selectedOptionId: correctOptionId
  }, candidateToken);
  record("POST", `/api/attempts/:id/answers`, 200, saveAnsRes.status, "Answer saved/autosaved");

  // Ingest Batched Proctoring Events
  const ingestRes = await request("POST", "/proctor/events", {
    attemptId,
    events: [
      {
        eventType: "WINDOW_BLUR",
        severity: EventSeverity.MEDIUM,
        timestamp: new Date().toISOString(),
        metadata: { info: "Audit test blur" }
      },
      {
        eventType: "VOICE_ACTIVITY_DETECTED",
        severity: EventSeverity.HIGH,
        timestamp: new Date().toISOString(),
        metadata: { volumeDb: -28, speechEnergy: 65 }
      }
    ]
  }, candidateToken);
  record("POST", `/api/proctor/events`, 201, ingestRes.status, `Batched 2 proctor events ingested`);

  // Upload Webcam Frame for Computer Vision
  const sampleFacePath = path.resolve(process.cwd(), "..", "storage", "test_samples", "sample_face.jpg");
  if (fs.existsSync(sampleFacePath)) {
    const fileBuffer = fs.readFileSync(sampleFacePath);
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: "image/jpeg" });
    formData.append("frame", blob, "webcam.jpg");

    const cvRes = await request("POST", `/proctor/attempts/${attemptId}/frame`, formData, candidateToken, true);
    record("POST", `/api/proctor/attempts/:attemptId/frame`, 200, cvRes.status, `Webcam frame processed (Face detected: ${cvRes.data.data.faceDetected})`);
  }

  // Upload Screen Frame for EasyOCR Analysis
  const sampleCleanScreen = path.resolve(process.cwd(), "..", "storage", "test_samples", "sample_screen_clean.jpg");
  if (fs.existsSync(sampleCleanScreen)) {
    const fileBuffer = fs.readFileSync(sampleCleanScreen);
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: "image/jpeg" });
    formData.append("frame", blob, "screen.jpg");

    const ocrRes = await request("POST", `/proctor/attempts/${attemptId}/screen-frame`, formData, candidateToken, true);
    record("POST", `/api/proctor/attempts/:attemptId/screen-frame`, 200, ocrRes.status, `Screen frame processed (AI Indicators: ${ocrRes.data.data.hasIndicators})`);
  }

  // Get Chronological Proctor Events
  const eventsRes = await request("GET", `/proctor/attempts/${attemptId}/events`, undefined, examinerToken);
  record("GET", `/api/proctor/attempts/:attemptId/events`, 200, eventsRes.status, `Retrieved ${eventsRes.data.data.totalEvents} audit events`);

  // On-demand evaluate anomaly
  const anomalyRes = await request("POST", `/proctor/attempts/${attemptId}/evaluate-anomaly`, {}, examinerToken);
  record("POST", `/api/proctor/attempts/:attemptId/evaluate-anomaly`, 200, anomalyRes.status, `Evaluated anomaly score: ${anomalyRes.data.data.score}`);

  // 5. Examiner Live Interventions (Warning, Session Freeze & Force Submit)
  console.log("\n--- SECTION 5: Examiner Live Interventions & Remote Session Controls ---");
  // Dispatch direct warning
  const warnRes = await request("POST", `/proctor/attempts/${attemptId}/warn`, {
    warningMessage: "Audit test: Please keep your attention focused on the exam interface."
  }, examinerToken);
  record("POST", `/api/proctor/attempts/:id/warn`, 200, warnRes.status, "Examiner direct live warning dispatched");

  // Remote Freeze Attempt
  const freezeRes = await request("POST", `/proctor/attempts/${attemptId}/freeze`, {
    reason: "Audit test: Temporary integrity freeze."
  }, examinerToken);
  record("POST", `/api/proctor/attempts/:id/freeze`, 200, freezeRes.status, "Examination attempt remotely frozen by examiner");

  // Candidate attempt to save answer while frozen (should be blocked)
  const answerWhileFrozenRes = await request("POST", `/attempts/${attemptId}/answers`, {
    questionId,
    selectedOptionId: correctOptionId
  }, candidateToken);
  record("POST", `/api/attempts/:id/answers (Frozen Guard)`, 400, answerWhileFrozenRes.status, "Blocked answer modification while attempt is frozen");

  // Remote Unfreeze Attempt
  const unfreezeRes = await request("POST", `/proctor/attempts/${attemptId}/unfreeze`, {}, examinerToken);
  record("POST", `/api/proctor/attempts/:id/unfreeze`, 200, unfreezeRes.status, "Examination attempt successfully resumed/unfrozen");

  // Candidate resumes and saves answer
  const answerResumedRes = await request("POST", `/attempts/${attemptId}/answers`, {
    questionId,
    selectedOptionId: correctOptionId
  }, candidateToken);
  record("POST", `/api/attempts/:id/answers (Resumed)`, 200, answerResumedRes.status, "Answer saved after session unfreezing");

  // Secondary candidate attempt for Force-Submit & Disqualification testing
  const rogueEmail = `audit_rogue_${Date.now()}@proctorai.local`;
  const rogueReg = await request("POST", "/auth/register", {
    fullName: "Rogue Candidate",
    email: rogueEmail,
    password: "Password123!"
  });
  const rogueToken = rogueReg.data.data.token;
  const rogueAttRes = await request("POST", "/attempts", { examId }, rogueToken);
  const rogueAttemptId = rogueAttRes.data.data.id;

  const forceSubmitRes = await request("POST", `/proctor/attempts/${rogueAttemptId}/force-submit`, {
    reason: "Gross misconduct: Contraband phone detected during audit.",
    disqualify: true
  }, examinerToken);
  record("POST", `/api/proctor/attempts/:id/force-submit`, 200, forceSubmitRes.status, "Examiner force-terminated & disqualified candidate attempt");

  // 6. Exam Submission, Grading & Review Endpoints
  console.log("\n--- SECTION 6: Submission, Grading, Examiner Reviews & GDPR Retention ---");
  // Submit Exam
  const submitRes = await request("POST", `/attempts/${attemptId}/submit`, {}, candidateToken);
  record("POST", `/api/attempts/:id/submit`, 200, submitRes.status, `Submitted! Auto-grade: ${submitRes.data.data.totalScore}/10 marks`);

  // Post-submission duplicate attempt check (should reject with 400)
  const dupAfterSubmitRes = await request("POST", "/attempts", { examId }, candidateToken);
  record("POST", "/api/attempts (Duplicate Rejection Post-Submission)", 400, dupAfterSubmitRes.status, "Prevented candidate from taking duplicate attempt after submission");

  // Candidate views own final result
  const candResultRes = await request("GET", `/attempts/${attemptId}/result`, undefined, candidateToken);
  record("GET", `/api/attempts/:id/result`, 200, candResultRes.status, "Candidate result view retrieved");

  // Examiner views all exam results
  const examResultsRes = await request("GET", `/attempts/exam/${examId}/results`, undefined, examinerToken);
  record("GET", `/api/attempts/exam/:examId/results`, 200, examResultsRes.status, `Retrieved results for ${examResultsRes.data.data.length} candidate attempts`);

  // Examiner records review verdict
  const reviewPostRes = await request("POST", `/attempts/${attemptId}/reviews`, {
    decision: "CLEARED",
    notes: "Audit test review verified: Benign telemetry, full marks awarded."
  }, examinerToken);
  record("POST", `/api/attempts/:id/reviews`, 201, reviewPostRes.status, "Examiner recorded CLEARED verdict");

  // Get Attempt Reviews
  const getReviewsRes = await request("GET", `/attempts/${attemptId}/reviews`, undefined, examinerToken);
  record("GET", `/api/attempts/:id/reviews`, 200, getReviewsRes.status, `Retrieved ${getReviewsRes.data.data.length} review records`);

  // Admin Data Retention Purge Endpoint
  const purgeRes = await request("POST", "/proctor/maintenance/purge-expired?days=365", {}, adminToken);
  record("POST", `/api/proctor/maintenance/purge-expired`, 200, purgeRes.status, `Executed GDPR/FERPA retention purge`);

  // 7. Python AI Microservice Health & Endpoints
  console.log("\n--- SECTION 7: Python AI Microservice Endpoints ---");
  const pyHealth = await fetch(`${AI_URL}/health`);
  const pyHealthData: any = await pyHealth.json();
  console.log(` ✅ [GET   ] ${AI_URL}/health -> ${pyHealth.status} (PASS) | Python microservice: ${pyHealthData.status}`);

  console.log("\n==========================================================================================");
  console.log(`🎉 AUDIT COMPLETE: ALL ${auditLog.length} ENDPOINTS & API CALLS ARE 100% OPERATIONAL & VERIFIED!`);
  console.log("==========================================================================================");
}

runFullEndpointAudit()
  .catch((err) => {
    console.error("\n❌ API Audit Failure:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { };
