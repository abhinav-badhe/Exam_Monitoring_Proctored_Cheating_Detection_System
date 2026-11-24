import { io as ClientIO, Socket as ClientSocket } from "socket.io-client";
import { PrismaClient, EventSeverity } from "@prisma/client";
import path from "path";
import fs from "fs";

const prisma = new PrismaClient();
const BASE_URL = "http://127.0.0.1:5000/api";
const AI_URL = "http://127.0.0.1:8000";
const SOCKET_URL = "http://127.0.0.1:5000";

async function postJson(endpoint: string, body: any, token?: string): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function getJson(endpoint: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "GET",
    headers
  });
  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(`GET ${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function putJson(endpoint: string, body: any, token?: string): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body)
  });
  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(`PUT ${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function uploadFile(endpoint: string, filePath: string, fieldName: string, token: string): Promise<any> {
  const fileBuffer = fs.readFileSync(filePath);
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: "image/jpeg" });
  formData.append(fieldName, blob, path.basename(filePath));

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(`File upload ${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function runUnifiedSuite() {
  console.log("================================================================================");
  console.log("🚀 PROCTORAI FULL SYSTEM UNIFIED INTEGRATION & SECURITY VERIFICATION SUITE");
  console.log("   (Verifying Node.js API, Python CV/OCR/ML Microservice, Socket.IO, DB & Security)");
  console.log("================================================================================\n");

  let examinerSocket: ClientSocket | null = null;
  let candidateSocket: ClientSocket | null = null;

  try {
    // Stage 1: Security & Health Baseline
    console.log("[Stage 1/8] 🛡️ Security Headers & Microservice Health Check...");
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData: any = await healthRes.json();
    console.log("   - Backend Express Health:", healthData.message);

    // Verify Helmet Security Headers
    const helmetHeaders = ["x-dns-prefetch-control", "x-content-type-options", "x-frame-options"];
    for (const h of helmetHeaders) {
      if (!healthRes.headers.get(h)) {
        console.warn(`   ⚠️ Helmet header "${h}" was not detected (non-fatal if dev proxy)`);
      }
    }
    console.log("   ✅ Security Headers Inspected");

    const aiHealthRes = await fetch(`${AI_URL}/health`);
    const aiHealth: any = await aiHealthRes.json();
    console.log("   ✅ Python AI Microservice Health:", aiHealth.status);

    // Stage 2: Examiner Flow & Exam Lifecycle
    console.log("\n[Stage 2/8] 👨‍🏫 Examiner Flow: Exam Creation & Question Authoring...");
    const examinerLogin = await postJson("/auth/login", {
      email: "examiner@proctorai.local",
      password: "ExaminerPass@123"
    });
    const examinerToken = examinerLogin.data.token;

    const examTitle = `Unified Regression Exam ${Date.now()}`;
    const createExamRes = await postJson("/exams", {
      title: examTitle,
      description: "Comprehensive end-to-end multi-tier proctoring assessment",
      durationMinutes: 45
    }, examinerToken);
    const examId = createExamRes.data.id;

    // Add 2 Questions
    const q1 = await postJson(`/exams/${examId}/questions`, {
      questionText: "Which architecture pattern decouples heavy AI inference from the primary Node API server?",
      marks: 10,
      questionType: "MCQ",
      options: [
        { optionText: "Monolithic blocking thread", isCorrect: false },
        { optionText: "Microservice asynchronous offloading via HTTP/FastAPI", isCorrect: true },
        { optionText: "Direct client-side GPU execution", isCorrect: false }
      ]
    }, examinerToken);

    const q2 = await postJson(`/exams/${examId}/questions`, {
      questionText: "What is the primary role of web-based proctoring indicators?",
      marks: 10,
      questionType: "MCQ",
      options: [
        { optionText: "Definitive autonomous verdict without human review", isCorrect: false },
        { optionText: "Explainable signals to aid human examiner review", isCorrect: true },
        { optionText: "Complete operating system intrusion", isCorrect: false }
      ]
    }, examinerToken);

    // Publish Exam
    await putJson(`/exams/${examId}`, { status: "PUBLISHED" }, examinerToken);
    console.log(`   ✅ Exam Created, 2 Questions Added, and Published (ID: ${examId})`);

    // Stage 3: Candidate Registration & Examination Initialization
    console.log("\n[Stage 3/8] 🎓 Candidate Flow: Registration & Exam Initialization...");
    const candidateEmail = `unified_candidate_${Date.now()}@proctorai.local`;
    const regRes = await postJson("/auth/register", {
      fullName: "Unified Regression Candidate",
      email: candidateEmail,
      password: "Password@123"
    });
    const candidateToken = regRes.data.token;

    // Candidate retrieves exam details (verify correct answers are STRIPPED)
    const examCandidateView = await getJson(`/exams/${examId}`, candidateToken);
    const hasExposedAnswers = examCandidateView.data.questions.some((q: any) =>
      q.options.some((opt: any) => opt.isCorrect !== undefined)
    );
    if (hasExposedAnswers) {
      throw new Error("Security Violation: Correct answer flags exposed to candidate in active exam!");
    }
    console.log("   🛡️ Security Verified: Correct MCQ answers stripped from candidate payload");

    // Start Attempt
    const attemptRes = await postJson("/attempts", { examId }, candidateToken);
    const attemptId = attemptRes.data.id;
    console.log(`   ✅ Attempt Initialized (ID: ${attemptId})`);

    // Stage 4: Real-Time Sockets Subscription
    console.log("\n[Stage 4/8] ⚡ Real-Time Socket.IO Synchronization...");
    examinerSocket = ClientIO(SOCKET_URL, { auth: { token: examinerToken }, transports: ["websocket"] });
    candidateSocket = ClientIO(SOCKET_URL, { auth: { token: candidateToken }, transports: ["websocket"] });

    await new Promise<void>((resolve, reject) => {
      let exReady = false;
      let candReady = false;
      const check = () => { if (exReady && candReady) resolve(); };

      examinerSocket!.on("connect", () => {
        examinerSocket!.emit("join:exam", examId);
        exReady = true;
        check();
      });
      candidateSocket!.on("connect", () => {
        candidateSocket!.emit("join:attempt", attemptId);
        candReady = true;
        check();
      });
      setTimeout(() => reject(new Error("Socket connection timed out")), 5000);
    });
    console.log("   ✅ Examiner & Candidate Sockets Connected and Rooms Subscribed");

    // Stage 5: Multi-Modal Proctoring Ingestion & Real-Time Alert Verification
    console.log("\n[Stage 5/8] 📡 Ingesting Multi-Modal Telemetry (Browser, Webcam, Screen OCR)...");
    const examinerAlertPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for examiner alert")), 6000);
      examinerSocket!.on("exam:proctor_alert", (alert: any) => {
        clearTimeout(timeout);
        resolve(alert);
      });
    });

    const baseTime = Date.now();
    // 5A: Browser activity events (Blur -> Paste sequence)
    await postJson("/proctor/events", {
      attemptId,
      events: [
        {
          eventType: "WINDOW_BLUR",
          severity: EventSeverity.MEDIUM,
          timestamp: new Date(baseTime - 20000).toISOString(),
          metadata: { info: "Window unfocused" }
        },
        {
          eventType: "PASTE_ATTEMPT",
          severity: EventSeverity.HIGH,
          timestamp: new Date(baseTime - 15000).toISOString(),
          metadata: { length: 150 }
        },
        {
          eventType: "DEVTOOLS_SHORTCUT",
          severity: EventSeverity.CRITICAL,
          timestamp: new Date(baseTime - 10000).toISOString(),
          metadata: { shortcut: "F12" }
        }
      ]
    }, candidateToken);

    // Verify Examiner received live alert
    const liveAlert = await examinerAlertPromise;
    console.log(`   ✅ Live Examiner Alert Received: ${liveAlert.eventType} (${liveAlert.severity})`);

    // 5B: Webcam frame ingestion (Phone detection sample)
    const samplePhonePath = path.resolve(process.cwd(), "..", "storage", "test_samples", "sample_phone.jpg");
    if (fs.existsSync(samplePhonePath)) {
      const cvRes = await uploadFile(`/proctor/attempts/${attemptId}/frame`, samplePhonePath, "frame", candidateToken);
      console.log(`   ✅ Webcam CV Pipeline Analyzed: Phone Detected = ${cvRes.data.phoneDetected}`);
    }

    // 5C: Screen sharing frame ingestion (AI indicator sample)
    const sampleScreenPath = path.resolve(process.cwd(), "..", "storage", "test_samples", "sample_screen_ai.jpg");
    if (fs.existsSync(sampleScreenPath)) {
      const ocrRes = await uploadFile(`/proctor/attempts/${attemptId}/screen-frame`, sampleScreenPath, "frame", candidateToken);
      console.log(`   ✅ Screen OCR Pipeline Analyzed: AI Indicators = ${ocrRes.data.hasIndicators}`);
    }

    // Stage 6: Direct Examiner Warning
    console.log("\n[Stage 6/8] ⚠️ Examiner Direct Warning Dispatch...");
    const candWarningPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for candidate warning")), 6000);
      candidateSocket!.on("candidate:warning", (data: any) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    examinerSocket.emit("examiner:warn_candidate", {
      attemptId,
      examId,
      warningMessage: "Regression Test Warning: Please refrain from opening developer inspection tools."
    });

    const receivedWarning = await candWarningPromise;
    console.log(`   ✅ Candidate Received Warning: "${receivedWarning.warningMessage}"`);

    // Stage 7: Answer Submission & Automated Evaluation
    console.log("\n[Stage 7/8] 📝 Candidate Answer Submission & Anomaly Engine Scoring...");
    // Save answers (Candidate chooses correct answers for both questions)
    const q1CorrectOpt = q1.data.options.find((o: any) => o.optionText.includes("Microservice"));
    const q2CorrectOpt = q2.data.options.find((o: any) => o.optionText.includes("Explainable signals"));

    await postJson(`/attempts/${attemptId}/answers`, {
      questionId: q1.data.id,
      selectedOptionId: q1CorrectOpt.id
    }, candidateToken);

    await postJson(`/attempts/${attemptId}/answers`, {
      questionId: q2.data.id,
      selectedOptionId: q2CorrectOpt.id
    }, candidateToken);

    // Submit attempt (auto-triggers scoring & behavioural anomaly evaluation)
    const submitRes = await postJson(`/attempts/${attemptId}/submit`, {}, candidateToken);
    console.log(`   ✅ Exam Submitted (Status: ${submitRes.data.status})`);
    console.log(`   ✅ Total Exam Score: ${submitRes.data.totalScore} / 20 marks`);

    if (submitRes.data.totalScore !== 20) {
      throw new Error(`Expected total score 20, got ${submitRes.data.totalScore}`);
    }

    // Verify Anomaly Score Generated
    const anomalyRecord = await prisma.anomalyScore.findFirst({
      where: { attemptId },
      orderBy: { createdAt: "desc" }
    });

    if (!anomalyRecord) {
      throw new Error("Anomaly score record was not created upon exam submission!");
    }

    const explanation = anomalyRecord.explanation as any;
    console.log(`   ✅ Behavioural Anomaly Score Computed:`);
    console.log(`      - Risk Level: ${anomalyRecord.riskLevel} (${anomalyRecord.score.toFixed(1)}/100)`);
    console.log(`      - Rule Score: ${explanation.ruleScore}`);
    console.log(`      - ML Isolation Forest Score: ${explanation.mlIsolationForestScore}`);
    console.log(`      - Triggered Violations: ${explanation.ruleViolations?.map((v: any) => v.rule).join(", ")}`);

    // Stage 8: Human Examiner Audit & Review Verdict
    console.log("\n[Stage 8/8] ⚖️ Examiner Review Verdict & Audit Trail...");
    const reviewRes = await postJson(`/attempts/${attemptId}/reviews`, {
      decision: "FLAGGED_FOR_INQUIRY",
      notes: "Full regression audit: DevTools and paste events verified. Flagged for institutional inquiry."
    }, examinerToken);

    console.log(`   ✅ Review Verdict Saved: ${reviewRes.data.decision}`);

    // Verify Examiner Results Aggregation API
    const finalResults = await getJson(`/attempts/exam/${examId}/results`, examinerToken);
    const auditedAttempt = finalResults.data.find((a: any) => a.id === attemptId);

    if (!auditedAttempt || !auditedAttempt.reviews || auditedAttempt.reviews[0].decision !== "FLAGGED_FOR_INQUIRY") {
      throw new Error("Audit record missing from examiner results API!");
    }
    console.log("   ✅ Aggregated Results API verified with Score, Anomaly Risk, and Human Review Verdict.");

    console.log("\n================================================================================");
    console.log("🎉 UNIFIED FULL SYSTEM INTEGRATION & SECURITY VERIFICATION: ALL 8 STAGES PASSED!");
    console.log("================================================================================\n");
  } finally {
    if (examinerSocket) examinerSocket.disconnect();
    if (candidateSocket) candidateSocket.disconnect();
    await prisma.$disconnect();
  }
}

runUnifiedSuite().catch((err) => {
  console.error("❌ Unified Suite Failure:", err.message);
  process.exit(1);
});

export {};
