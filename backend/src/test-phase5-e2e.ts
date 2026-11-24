import { PrismaClient, EventSeverity } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://127.0.0.1:5000/api";
const AI_URL = "http://127.0.0.1:8000";

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

async function runPhase5E2E() {
  console.log("==================================================");
  console.log("🧪 RUNNING PROCTORAI PHASE 5 (BEHAVIOURAL ANOMALY ENGINE) E2E VERIFICATION");
  console.log("==================================================");

  // 1. Python AI Health Check
  console.log("\n[1/5] Verifying Python AI Service Health...");
  const aiHealthRes = await fetch(`${AI_URL}/health`);
  const aiHealth: any = await aiHealthRes.json();
  console.log("✅ Python AI Microservice Health:", aiHealth.status);

  // 2. Examiner Login & Active Exam retrieval
  console.log("\n[2/5] Authenticating Examiner...");
  const examinerLogin = await postJson("/auth/login", {
    email: "examiner@proctorai.local",
    password: "ExaminerPass@123"
  });
  const examinerToken = examinerLogin.data.token;
  console.log("✅ Examiner Authenticated");

  const exams = await getJson("/exams", examinerToken);
  const activeExam = exams.data.find((e: any) => e.status === "PUBLISHED");
  if (!activeExam) throw new Error("No published exam found for Phase 5 test");

  // 3. Normal Session Test (Candidate A -> Low Anomaly Risk)
  console.log("\n[3/5] Testing Normal Candidate Session (Expected: LOW Risk)...");
  const normalCandidateEmail = `candidate_clean_${Date.now()}@proctorai.local`;
  const regNormal = await postJson("/auth/register", {
    fullName: "Clean Session Candidate",
    email: normalCandidateEmail,
    password: "Password@123"
  });
  const normalToken = regNormal.data.token;

  const normalAttempt = await postJson("/attempts", { examId: activeExam.id }, normalToken);
  const normalAttemptId = normalAttempt.data.id;

  // Ingest regular benign telemetry
  const now = new Date();
  await postJson("/proctor/events", {
    attemptId: normalAttemptId,
    events: [
      {
        eventType: "INTERACTION_SUMMARY",
        severity: EventSeverity.INFO,
        timestamp: new Date(now.getTime() - 20000).toISOString(),
        metadata: { mouseDistance: 120, scrollDelta: 50, keyPressCount: 15 }
      },
      {
        eventType: "INTERACTION_SUMMARY",
        severity: EventSeverity.INFO,
        timestamp: new Date(now.getTime() - 10000).toISOString(),
        metadata: { mouseDistance: 95, scrollDelta: 20, keyPressCount: 8 }
      }
    ]
  }, normalToken);

  // Submit attempt (auto-triggers anomaly evaluation)
  const normalSubmit = await postJson(`/attempts/${normalAttemptId}/submit`, {}, normalToken);
  console.log(`✅ Normal Attempt Submitted (Status: ${normalSubmit.data.status})`);

  // Verify DB AnomalyScore for Candidate A
  const normalScoreRecord = await prisma.anomalyScore.findFirst({
    where: { attemptId: normalAttemptId },
    orderBy: { createdAt: "desc" }
  });

  if (!normalScoreRecord) {
    throw new Error("Anomaly score record was not created for normal candidate attempt!");
  }

  console.log("✅ Normal Session Anomaly Evaluation Result:");
  console.log(`   - Risk Level: ${normalScoreRecord.riskLevel}`);
  console.log(`   - Anomaly Score: ${normalScoreRecord.score}/100.0`);
  console.log(`   - Model Version: ${normalScoreRecord.modelVersion}`);

  if (normalScoreRecord.riskLevel !== "LOW" && normalScoreRecord.riskLevel !== "MEDIUM") {
    throw new Error(`Expected LOW/MEDIUM risk for benign telemetry, got: ${normalScoreRecord.riskLevel}`);
  }

  // 4. Anomalous Session Test (Candidate B -> High/Critical Anomaly Risk)
  console.log("\n[4/5] Testing Anomalous Candidate Session (Sequence: Blur -> Paste, DevTools, AI indicator)...");
  const anomCandidateEmail = `candidate_anom_${Date.now()}@proctorai.local`;
  const regAnom = await postJson("/auth/register", {
    fullName: "Anomalous Session Candidate",
    email: anomCandidateEmail,
    password: "Password@123"
  });
  const anomToken = regAnom.data.token;

  const anomAttempt = await postJson("/attempts", { examId: activeExam.id }, anomToken);
  const anomAttemptId = anomAttempt.data.id;

  const baseTime = Date.now();
  // Simulate Blur -> 3s -> Paste sequence, plus DevTools shortcut and AI tool indicator
  await postJson("/proctor/events", {
    attemptId: anomAttemptId,
    events: [
      {
        eventType: "WINDOW_BLUR",
        severity: EventSeverity.MEDIUM,
        timestamp: new Date(baseTime - 30000).toISOString(),
        metadata: { info: "Candidate unfocused window" }
      },
      {
        eventType: "TAB_HIDDEN",
        severity: EventSeverity.MEDIUM,
        timestamp: new Date(baseTime - 28000).toISOString(),
        metadata: { info: "Candidate switched tab" }
      },
      {
        eventType: "WINDOW_FOCUS",
        severity: EventSeverity.INFO,
        timestamp: new Date(baseTime - 25000).toISOString(),
        metadata: { info: "Candidate returned" }
      },
      {
        eventType: "PASTE_ATTEMPT",
        severity: EventSeverity.HIGH,
        timestamp: new Date(baseTime - 23000).toISOString(), // 2s after return, within 20s of blur!
        metadata: { clipboardLength: 280 }
      },
      {
        eventType: "DEVTOOLS_SHORTCUT",
        severity: EventSeverity.HIGH,
        timestamp: new Date(baseTime - 15000).toISOString(),
        metadata: { shortcut: "F12" }
      },
      {
        eventType: "PHONE_DETECTED",
        severity: EventSeverity.HIGH,
        timestamp: new Date(baseTime - 10000).toISOString(),
        metadata: { confidence: 0.92 }
      },
      {
        eventType: "EXTERNAL_AI_INDICATOR",
        severity: EventSeverity.CRITICAL,
        timestamp: new Date(baseTime - 5000).toISOString(),
        metadata: { matches: ["chatgpt", "openai"] }
      }
    ]
  }, anomToken);

  // Submit attempt
  const anomSubmit = await postJson(`/attempts/${anomAttemptId}/submit`, {}, anomToken);
  console.log(`✅ Anomalous Attempt Submitted (Status: ${anomSubmit.data.status})`);

  // Verify DB AnomalyScore for Candidate B
  const anomScoreRecord = await prisma.anomalyScore.findFirst({
    where: { attemptId: anomAttemptId },
    orderBy: { createdAt: "desc" }
  });

  if (!anomScoreRecord) {
    throw new Error("Anomaly score record was not created for anomalous candidate attempt!");
  }

  const explanation = anomScoreRecord.explanation as any;
  console.log("✅ Anomalous Session Anomaly Evaluation Result:");
  console.log(`   - Risk Level: ${anomScoreRecord.riskLevel}`);
  console.log(`   - Anomaly Score: ${anomScoreRecord.score}/100.0`);
  console.log(`   - Rule Score: ${explanation.ruleScore}/100.0`);
  console.log(`   - ML Isolation Forest Score: ${explanation.mlIsolationForestScore}/100.0`);
  console.log(`   - Rule Violations Triggered: ${explanation.ruleViolations?.map((v: any) => v.rule).join(", ")}`);

  if (anomScoreRecord.riskLevel !== "HIGH" && anomScoreRecord.riskLevel !== "CRITICAL") {
    throw new Error(`Expected HIGH or CRITICAL risk for anomalous session, got: ${anomScoreRecord.riskLevel}`);
  }

  const triggeredRules = explanation.ruleViolations?.map((v: any) => v.rule) || [];
  if (!triggeredRules.includes("BLUR_PASTE_SEQUENCE")) {
    throw new Error("Expected BLUR_PASTE_SEQUENCE rule violation to be detected!");
  }
  if (!triggeredRules.includes("DEVTOOLS_INSPECTION_ATTEMPT")) {
    throw new Error("Expected DEVTOOLS_INSPECTION_ATTEMPT rule violation to be detected!");
  }
  if (!triggeredRules.includes("EXTERNAL_AI_ASSISTANT_INDICATOR")) {
    throw new Error("Expected EXTERNAL_AI_ASSISTANT_INDICATOR rule violation to be detected!");
  }
  console.log("🛡️ Passed: Multi-signal correlation rules verified with explainable JSON output.");

  // 5. Examiner Results API Auditing
  console.log("\n[5/5] Auditing Examiner Results Aggregation API...");
  const resultsRes = await getJson(`/attempts/exam/${activeExam.id}/results`, examinerToken);
  const results = resultsRes.data;

  const normalEntry = results.find((r: any) => r.id === normalAttemptId);
  const anomEntry = results.find((r: any) => r.id === anomAttemptId);

  if (!normalEntry || !normalEntry.scores || normalEntry.scores.length === 0) {
    throw new Error("Examiner results missing anomaly score for normal attempt!");
  }
  if (!anomEntry || !anomEntry.scores || anomEntry.scores.length === 0) {
    throw new Error("Examiner results missing anomaly score for anomalous attempt!");
  }

  console.log("✅ Examiner Results View Verified:");
  console.log(`   - Candidate A Score: ${normalEntry.scores[0].score} (${normalEntry.scores[0].riskLevel})`);
  console.log(`   - Candidate B Score: ${anomEntry.scores[0].score} (${anomEntry.scores[0].riskLevel})`);

  console.log("\n==================================================");
  console.log("🎉 ALL PHASE 5 (BEHAVIOURAL ANOMALY DETECTION ENGINE) CRITERIA VERIFIED SUCCESSFULLY!");
  console.log("==================================================");
}

runPhase5E2E()
  .catch((err) => {
    console.error("❌ Phase 5 E2E Test Failure:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export {};
