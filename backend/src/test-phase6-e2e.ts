import { io as ClientIO, Socket as ClientSocket } from "socket.io-client";
import { PrismaClient, EventSeverity } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://127.0.0.1:5000/api";
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

async function runPhase6E2E() {
  console.log("==================================================");
  console.log("🧪 RUNNING PROCTORAI PHASE 6 (REAL-TIME SOCKET.IO & EXAMINER REVIEW) E2E VERIFICATION");
  console.log("==================================================");

  let examinerSocket: ClientSocket | null = null;
  let candidateSocket: ClientSocket | null = null;

  try {
    // 1. Authenticate Examiner
    console.log("\n[1/6] Authenticating Examiner...");
    const examinerLogin = await postJson("/auth/login", {
      email: "examiner@proctorai.local",
      password: "ExaminerPass@123"
    });
    const examinerToken = examinerLogin.data.token;
    console.log("✅ Examiner Authenticated");

    // 2. Fetch Active Published Exam
    const exams = await getJson("/exams", examinerToken);
    const activeExam = exams.data.find((e: any) => e.status === "PUBLISHED");
    if (!activeExam) throw new Error("No published exam found for Phase 6 test");
    console.log(`✅ Active Exam Found: "${activeExam.title}" (ID: ${activeExam.id})`);

    // 3. Register & Authenticate Candidate
    const candidateEmail = `candidate_p6_${Date.now()}@proctorai.local`;
    console.log(`\n[2/6] Registering Candidate (${candidateEmail})...`);
    const regRes = await postJson("/auth/register", {
      fullName: "Socket Proctor Candidate",
      email: candidateEmail,
      password: "Password@123"
    });
    const candidateToken = regRes.data.token;
    const candidateId = regRes.data.user.id;

    // Start Attempt
    const attemptRes = await postJson("/attempts", { examId: activeExam.id }, candidateToken);
    const attemptId = attemptRes.data.id;
    console.log(`✅ Candidate Attempt Initialized (ID: ${attemptId})`);

    // 4. Connect Sockets
    console.log("\n[3/6] Connecting Real-Time Sockets & Joining Rooms...");
    examinerSocket = ClientIO(SOCKET_URL, {
      auth: { token: examinerToken },
      transports: ["websocket"]
    });

    candidateSocket = ClientIO(SOCKET_URL, {
      auth: { token: candidateToken },
      transports: ["websocket"]
    });

    await new Promise<void>((resolve, reject) => {
      let exConnected = false;
      let candConnected = false;

      const check = () => {
        if (exConnected && candConnected) resolve();
      };

      examinerSocket!.on("connect", () => {
        exConnected = true;
        examinerSocket!.emit("join:exam", activeExam.id);
        check();
      });

      candidateSocket!.on("connect", () => {
        candConnected = true;
        candidateSocket!.emit("join:attempt", attemptId);
        check();
      });

      setTimeout(() => reject(new Error("Socket connection timeout after 6 seconds")), 6000);
    });
    console.log("✅ Examiner joined room: exam:" + activeExam.id);
    console.log("✅ Candidate joined room: attempt:" + attemptId);

    // 5. Test Live Proctor Alert Broadcast
    console.log("\n[4/6] Verifying Live Proctor Alert Broadcast to Examiner Room...");
    const alertPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for exam:proctor_alert")), 6000);
      examinerSocket!.on("exam:proctor_alert", (alert: any) => {
        clearTimeout(timeout);
        resolve(alert);
      });
    });

    // Ingest High-severity event as Candidate
    await postJson("/proctor/events", {
      attemptId,
      events: [
        {
          eventType: "DEVTOOLS_SHORTCUT",
          severity: EventSeverity.CRITICAL,
          timestamp: new Date().toISOString(),
          metadata: { shortcut: "Ctrl+Shift+I" }
        }
      ]
    }, candidateToken);

    const receivedAlert = await alertPromise;
    console.log("✅ Examiner Received Real-Time Alert via Socket.IO:");
    console.log(`   - Event Type: ${receivedAlert.eventType}`);
    console.log(`   - Severity: ${receivedAlert.severity}`);
    console.log(`   - Candidate Name: ${receivedAlert.candidate?.fullName}`);

    if (receivedAlert.eventType !== "DEVTOOLS_SHORTCUT" || receivedAlert.attemptId !== attemptId) {
      throw new Error("Received alert metadata did not match emitted proctor event!");
    }

    // 6. Test Direct Warning from Examiner to Candidate
    console.log("\n[5/6] Testing Direct Warning Dispatch (Examiner -> Candidate)...");
    const warningMessage = "Please keep your exam window active and refrain from inspection shortcuts.";

    const warningPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for candidate:warning")), 6000);
      candidateSocket!.on("candidate:warning", (data: any) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    examinerSocket.emit("examiner:warn_candidate", {
      attemptId,
      examId: activeExam.id,
      warningMessage
    });

    const receivedWarning = await warningPromise;
    console.log("✅ Candidate Received Direct Proctor Warning in Real-Time:");
    console.log(`   - Message: "${receivedWarning.warningMessage}"`);
    console.log(`   - Sent By: ${receivedWarning.sentBy}`);

    if (receivedWarning.warningMessage !== warningMessage) {
      throw new Error("Received warning message did not match dispatched warning!");
    }

    // 7. Test Examiner Review Decision Workflow
    console.log("\n[6/6] Testing Examiner Human Review Decision & Audit Trail...");
    const reviewRes = await postJson(`/attempts/${attemptId}/reviews`, {
      decision: "FLAGGED_FOR_INQUIRY",
      notes: "Candidate attempted DevTools shortcut. Live warning was issued and acknowledged."
    }, examinerToken);

    console.log("✅ Review Decision Successfully Recorded:");
    console.log(`   - Decision: ${reviewRes.data.decision}`);
    console.log(`   - Reviewer: ${reviewRes.data.reviewer.fullName} (${reviewRes.data.reviewer.email})`);
    console.log(`   - Notes: "${reviewRes.data.notes}"`);

    // Verify Review in Database
    const dbReview = await prisma.reviewRecord.findFirst({
      where: { attemptId }
    });
    if (!dbReview || dbReview.decision !== "FLAGGED_FOR_INQUIRY") {
      throw new Error("Review record not found in PostgreSQL review_records table!");
    }

    // Verify Review in Examiner Results API
    const resultsRes = await getJson(`/attempts/exam/${activeExam.id}/results`, examinerToken);
    const auditedAttempt = resultsRes.data.find((a: any) => a.id === attemptId);

    if (!auditedAttempt || !auditedAttempt.reviews || auditedAttempt.reviews.length === 0) {
      throw new Error("Examiner results endpoint did not include review record!");
    }
    console.log(`🛡️ Passed: Review verdict "${auditedAttempt.reviews[0].decision}" populated in examiner results aggregation.`);

    console.log("\n==================================================");
    console.log("🎉 ALL PHASE 6 (REAL-TIME SOCKET.IO & EXAMINER REVIEW) CRITERIA VERIFIED SUCCESSFULLY!");
    console.log("==================================================");
  } finally {
    if (examinerSocket) examinerSocket.disconnect();
    if (candidateSocket) candidateSocket.disconnect();
    await prisma.$disconnect();
  }
}

runPhase6E2E().catch((err) => {
  console.error("❌ Phase 6 E2E Test Failure:", err.message);
  process.exit(1);
});

export {};
