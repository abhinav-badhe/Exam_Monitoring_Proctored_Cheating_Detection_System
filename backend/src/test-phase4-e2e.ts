import fs from "fs";
import path from "path";

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

async function uploadScreenFrame(attemptId: string, imagePath: string, token: string): Promise<any> {
  const fileBuffer = fs.readFileSync(imagePath);
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: "image/jpeg" });
  formData.append("frame", blob, "screen.jpg");

  const res = await fetch(`${BASE_URL}/proctor/attempts/${attemptId}/screen-frame`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(`Upload screen frame failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function runPhase4E2E() {
  console.log("==================================================");
  console.log("🧪 RUNNING PROCTORAI PHASE 4 (SCREEN SHARING & OCR) E2E VERIFICATION");
  console.log("==================================================");

  // 1. Health check
  console.log("\n[1/6] Verifying Python AI Service Health...");
  const aiHealthRes = await fetch(`${AI_URL}/health`);
  const aiHealth: any = await aiHealthRes.json();
  console.log("✅ Python AI Microservice:", aiHealth.status);

  // 2. Candidate Registration & Login
  const candidateEmail = `candidate_p4_${Date.now()}@proctorai.local`;
  console.log(`\n[2/6] Registering Candidate (${candidateEmail})...`);
  const regRes = await postJson("/auth/register", {
    fullName: "Phase 4 OCR Candidate",
    email: candidateEmail,
    password: "Password@123"
  });
  const candidateToken = regRes.data.token;
  console.log("✅ Candidate Authenticated");

  // Examiner Login
  const examinerLogin = await postJson("/auth/login", {
    email: "examiner@proctorai.local",
    password: "ExaminerPass@123"
  });
  const examinerToken = examinerLogin.data.token;

  // Active exam
  const exams = await getJson("/exams", candidateToken);
  const activeExam = exams.data.find((e: any) => e.status === "PUBLISHED");
  if (!activeExam) throw new Error("No published exam found for Phase 4 test");

  // 3. Start Exam Attempt
  console.log("\n[3/6] Starting Exam Attempt...");
  const attemptRes = await postJson("/attempts", { examId: activeExam.id }, candidateToken);
  const attemptId = attemptRes.data.id;
  console.log(`✅ Attempt Initialized (ID: ${attemptId})`);

  // 4. Test Clean Screen Frame
  const cleanPath = path.resolve(process.cwd(), "..", "storage", "test_samples", "sample_screen_clean.jpg");
  console.log(`\n[4/6] Uploading Clean Shared-Screen Frame: ${cleanPath}...`);
  const cleanRes = await uploadScreenFrame(attemptId, cleanPath, candidateToken);
  console.log("✅ Clean Screen Frame Analyzed:");
  console.log(`   - Indicators Found: ${cleanRes.data.hasIndicators}`);
  console.log(`   - Detected Text Snippet: "${cleanRes.data.detectedTextSnippet.trim()}"`);

  if (cleanRes.data.hasIndicators !== false) {
    throw new Error("Expected hasIndicators=false on clean code screen!");
  }

  // 5. Test Screen Frame with Visible External AI References
  const aiPath = path.resolve(process.cwd(), "..", "storage", "test_samples", "sample_screen_ai.jpg");
  console.log(`\n[5/6] Uploading Screen Frame with Visible AI Reference: ${aiPath}...`);
  const aiRes = await uploadScreenFrame(attemptId, aiPath, candidateToken);
  console.log("✅ AI Reference Screen Frame Analyzed by EasyOCR:");
  console.log(`   - Indicators Found: ${aiRes.data.hasIndicators}`);
  console.log(`   - Anomalies Detected: ${aiRes.data.anomalies.map((a: any) => a.eventType).join(", ")}`);
  console.log(`   - Description: "${aiRes.data.anomalies[0]?.description}"`);

  if (!aiRes.data.hasIndicators) {
    throw new Error("Expected hasIndicators=true for screen frame containing ChatGPT/OpenAI reference!");
  }

  // 6. Examiner Audits Ingested Screen Evidence & Events
  console.log("\n[6/6] Examiner Auditing Screen Proctoring Logs & Saved Evidence...");
  const auditRes = await getJson(`/proctor/attempts/${attemptId}/events`, examinerToken);
  console.log(`✅ Total Events Logged in DB: ${auditRes.data.totalEvents}`);
  console.log("   - Severity Breakdown:", JSON.stringify(auditRes.data.severityBreakdown));

  const hasAIEvent = auditRes.data.events.some((e: any) => e.eventType === "EXTERNAL_AI_INDICATOR");
  if (!hasAIEvent) {
    throw new Error("EXTERNAL_AI_INDICATOR event was not recorded in PostgreSQL proctor_events table!");
  }
  console.log("🛡️ Passed: EXTERNAL_AI_INDICATOR proctoring record verified in database.");

  // Verify screen evidence files on disk
  const evidenceDir = path.resolve(process.cwd(), "..", "storage", "evidence");
  const screenFiles = fs.readdirSync(evidenceDir).filter((f) => f.includes("screen_") && f.includes(attemptId));
  console.log(`📸 Screen Evidence Snapshots Preserved: ${screenFiles.length} file(s)`);

  console.log("\n==================================================");
  console.log("🎉 ALL PHASE 4 (SCREEN SHARING, OCR & AI INDICATORS) CRITERIA VERIFIED SUCCESSFULLY!");
  console.log("==================================================");
}

runPhase4E2E().catch((err) => {
  console.error("❌ Phase 4 E2E Test Failure:", err.message);
  process.exit(1);
});

export {};
