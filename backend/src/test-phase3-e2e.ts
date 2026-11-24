import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:5000/api";
const AI_URL = "http://localhost:8000";

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

async function uploadFrame(attemptId: string, imagePath: string, token: string): Promise<any> {
  const fileBuffer = fs.readFileSync(imagePath);
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: "image/jpeg" });
  formData.append("frame", blob, "frame.jpg");

  const res = await fetch(`${BASE_URL}/proctor/attempts/${attemptId}/frame`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(`Upload frame failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function runPhase3E2E() {
  console.log("==================================================");
  console.log("🧪 RUNNING PROCTORAI PHASE 3 (COMPUTER VISION AI) E2E VERIFICATION");
  console.log("==================================================");

  // 1. Verify Python AI Microservice Health
  console.log("\n[1/6] Verifying Python AI Service Health...");
  const aiHealthRes = await fetch(`${AI_URL}/health`);
  const aiHealth: any = await aiHealthRes.json();
  console.log("✅ Python AI Service Status:", aiHealth.status, "- CV Pipeline:", aiHealth.cv_pipeline);

  // 2. Candidate Registration & Login
  const candidateEmail = `candidate_p3_${Date.now()}@proctorai.local`;
  console.log(`\n[2/6] Registering Candidate (${candidateEmail})...`);
  const regRes = await postJson("/auth/register", {
    fullName: "Phase 3 CV Candidate",
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
  if (!activeExam) throw new Error("No published exam found for Phase 3 test");

  // 3. Start Exam Attempt
  console.log("\n[3/6] Candidate Starting Exam Attempt...");
  const attemptRes = await postJson("/attempts", { examId: activeExam.id }, candidateToken);
  const attemptId = attemptRes.data.id;
  console.log(`✅ Attempt Initialized (ID: ${attemptId})`);

  // 4. Test Frame 1: Blank Frame (No Face)
  const blankPath = path.resolve(process.cwd(), "..", "storage", "test_samples", "sample_blank.jpg");
  console.log(`\n[4/6] Uploading Camera Frame (No Face) from: ${blankPath}...`);
  const blankResult = await uploadFrame(attemptId, blankPath, candidateToken);
  console.log("✅ Frame Analyzed by Python AI Service:");
  console.log(`   - Face Detected: ${blankResult.data.faceDetected}`);
  console.log(`   - Face Count: ${blankResult.data.faceCount}`);
  console.log(`   - Anomalies Detected: ${blankResult.data.anomalies.map((a: any) => a.eventType).join(", ")}`);

  if (blankResult.data.faceDetected !== false) {
    throw new Error("Expected faceDetected to be false for blank image");
  }

  // 5. Test Direct Computer Vision Endpoint with Face Image
  const facePath = path.resolve(process.cwd(), "..", "storage", "test_samples", "sample_face.jpg");
  console.log(`\n[5/6] Uploading Sample Face Image: ${facePath}...`);
  const faceResult = await uploadFrame(attemptId, facePath, candidateToken);
  console.log("✅ Sample Frame Processed:");
  console.log(`   - Phone Detected: ${faceResult.data.phoneDetected} (Conf: ${faceResult.data.phoneConfidence})`);
  console.log(`   - Head Pose:`, JSON.stringify(faceResult.data.headPose));

  // 6. Examiner Audits Saved Proctor Events & Evidence Snapshot
  console.log("\n[6/6] Examiner Auditing Ingested Computer Vision Events & Evidence...");
  const auditRes = await getJson(`/proctor/attempts/${attemptId}/events`, examinerToken);
  console.log(`✅ Total Events Logged in DB: ${auditRes.data.totalEvents}`);
  console.log("   - Severity Breakdown:", JSON.stringify(auditRes.data.severityBreakdown));

  const hasNoFaceEvent = auditRes.data.events.some((e: any) => e.eventType === "NO_FACE_DETECTED");
  if (!hasNoFaceEvent) {
    throw new Error("NO_FACE_DETECTED event was not recorded in PostgreSQL proctor_events table!");
  }
  console.log("🛡️ Passed: NO_FACE_DETECTED proctoring anomaly verified in database.");

  // Verify evidence files on disk
  const evidenceDir = path.resolve(process.cwd(), "..", "storage", "evidence");
  const files = fs.readdirSync(evidenceDir).filter((f) => f.includes(attemptId));
  console.log(`📸 Evidence Snapshots Saved on Disk: ${files.length} snapshot(s)`);

  console.log("\n==================================================");
  console.log("🎉 ALL PHASE 3 (WEBCAM & COMPUTER VISION AI) CRITERIA VERIFIED SUCCESSFULLY!");
  console.log("==================================================");
}

runPhase3E2E().catch((err) => {
  console.error("❌ Phase 3 E2E Test Failure:", err.message);
  process.exit(1);
});

export {};
