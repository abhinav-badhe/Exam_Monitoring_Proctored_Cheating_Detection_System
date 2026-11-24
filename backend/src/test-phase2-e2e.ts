const BASE_URL = "http://localhost:5000/api";

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

async function runPhase2E2E() {
  console.log("==================================================");
  console.log("🧪 RUNNING PROCTORAI PHASE 2 (BROWSER MONITORING) E2E VERIFICATION");
  console.log("==================================================");

  // 1. Candidate Registration & Login
  const candidateEmail = `candidate_p2_${Date.now()}@proctorai.local`;
  console.log(`\n[1/7] Registering Candidate (${candidateEmail})...`);
  const regRes = await postJson("/auth/register", {
    fullName: "Phase 2 Test Candidate",
    email: candidateEmail,
    password: "Password@123"
  });
  const candidateToken = regRes.data.token;
  console.log("✅ Candidate Authenticated");

  // 2. Examiner Login
  console.log("\n[2/7] Logging in Examiner...");
  const loginRes = await postJson("/auth/login", {
    email: "examiner@proctorai.local",
    password: "ExaminerPass@123"
  });
  const examinerToken = loginRes.data.token;
  console.log("✅ Examiner Authenticated");

  // Get active published exam
  const exams = await getJson("/exams", candidateToken);
  const activeExam = exams.data.find((e: any) => e.status === "PUBLISHED");
  if (!activeExam) throw new Error("No published exam found for Phase 2 test");
  console.log(`✅ Using Published Exam: "${activeExam.title}" (ID: ${activeExam.id})`);

  // 3. Start Candidate Attempt
  console.log("\n[3/7] Candidate Starting Exam Attempt...");
  const attemptRes = await postJson("/attempts", { examId: activeExam.id }, candidateToken);
  const attemptId = attemptRes.data.id;
  console.log(`✅ Candidate Attempt Created: ${attemptId}`);

  // 4. Batch Ingest Browser Monitoring Events
  console.log("\n[4/7] Ingesting Simulated Browser Proctoring Telemetry...");
  const simulatedEvents = [
    {
      eventType: "FULLSCREEN_ENTER",
      severity: "INFO",
      metadata: { mode: "requestFullscreen" },
      timestamp: new Date(Date.now() - 50000).toISOString()
    },
    {
      eventType: "TAB_HIDDEN",
      severity: "HIGH",
      metadata: { source: "document.visibilitychange", hiddenDurationMs: 4200 },
      timestamp: new Date(Date.now() - 40000).toISOString()
    },
    {
      eventType: "TAB_VISIBLE",
      severity: "INFO",
      metadata: { source: "document.visibilitychange" },
      timestamp: new Date(Date.now() - 35000).toISOString()
    },
    {
      eventType: "WINDOW_BLUR",
      severity: "MEDIUM",
      metadata: { source: "window.blur", activeElement: "BODY" },
      timestamp: new Date(Date.now() - 30000).toISOString()
    },
    {
      eventType: "WINDOW_FOCUS",
      severity: "INFO",
      metadata: { source: "window.focus" },
      timestamp: new Date(Date.now() - 25000).toISOString()
    },
    {
      eventType: "COPY_ATTEMPT",
      severity: "HIGH",
      metadata: { source: "clipboard.copy", length: 48 },
      timestamp: new Date(Date.now() - 20000).toISOString()
    },
    {
      eventType: "PASTE_ATTEMPT",
      severity: "HIGH",
      metadata: { source: "clipboard.paste", length: 120 },
      timestamp: new Date(Date.now() - 15000).toISOString()
    },
    {
      eventType: "DEVTOOLS_SHORTCUT",
      severity: "CRITICAL",
      metadata: { key: "F12", ctrlKey: false, shiftKey: false },
      timestamp: new Date(Date.now() - 10000).toISOString()
    },
    {
      eventType: "INTERACTION_SUMMARY",
      severity: "INFO",
      metadata: { mouseMoveTicks: 142, scrollTicks: 18, keyPressCount: 65 },
      timestamp: new Date().toISOString()
    }
  ];

  const ingestRes = await postJson(
    "/proctor/events",
    {
      attemptId,
      events: simulatedEvents
    },
    candidateToken
  );
  console.log(`✅ Telemetry Ingested: ${ingestRes.data.count} event(s) recorded`);

  // 5. Security Test: Ingest with another candidate's token to verify ownership protection
  console.log("\n[5/7] Security Verification: Foreign candidate cannot spoof events for this attempt...");
  const foreignCandidate = await postJson("/auth/register", {
    fullName: "Foreign Candidate",
    email: `foreign_${Date.now()}@proctorai.local`,
    password: "Password@123"
  });
  let securityPassed = false;
  try {
    await postJson(
      "/proctor/events",
      {
        attemptId,
        events: [{ eventType: "TAB_HIDDEN", severity: "HIGH" }]
      },
      foreignCandidate.data.token
    );
  } catch (err: any) {
    if (err.message.includes("Access denied")) {
      securityPassed = true;
    }
  }
  if (!securityPassed) {
    throw new Error("SECURITY FAILURE: Foreign candidate was able to inject events into another candidate's session!");
  }
  console.log("🛡️ Passed: Foreign candidates are strictly blocked from logging events for other attempts.");

  // 6. Examiner Retrieves Audit Trail & Severity Breakdown
  console.log("\n[6/7] Examiner Auditing Candidate Proctoring Telemetry...");
  const auditRes = await getJson(`/proctor/attempts/${attemptId}/events`, examinerToken);
  console.log(`✅ Examiner Audit Retrieved: ${auditRes.data.totalEvents} total event(s)`);
  console.log("   - Severity Breakdown:", JSON.stringify(auditRes.data.severityBreakdown));

  // Verify all expected events exist
  const eventTypesRetrieved = auditRes.data.events.map((e: any) => e.eventType);
  const expectedTypes = ["FULLSCREEN_ENTER", "TAB_HIDDEN", "WINDOW_BLUR", "COPY_ATTEMPT", "PASTE_ATTEMPT", "DEVTOOLS_SHORTCUT", "INTERACTION_SUMMARY"];
  for (const exp of expectedTypes) {
    if (!eventTypesRetrieved.includes(exp)) {
      throw new Error(`Missing expected event in audit trail: ${exp}`);
    }
  }
  console.log("✅ All proctoring event categories verified in audit trail.");

  // 7. Candidate Submits & Telemetry Permanence Check
  console.log("\n[7/7] Candidate Submitting Exam & Verifying Permanent Retention...");
  await postJson(`/attempts/${attemptId}/submit`, {}, candidateToken);
  const auditAfterSubmit = await getJson(`/proctor/attempts/${attemptId}/events`, examinerToken);
  console.log(`✅ Session Completed! Proctoring audit log preserved with ${auditAfterSubmit.data.totalEvents} records.`);

  console.log("\n==================================================");
  console.log("🎉 ALL PHASE 2 (BROWSER MONITORING) CRITERIA VERIFIED SUCCESSFULLY!");
  console.log("==================================================");
}

runPhase2E2E().catch((err) => {
  console.error("❌ Phase 2 E2E Test Failure:", err.message);
  process.exit(1);
});

export {};
