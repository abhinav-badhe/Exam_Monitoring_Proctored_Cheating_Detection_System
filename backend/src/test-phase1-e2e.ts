const BASE_URL = "http://localhost:5000/api";

async function postJson(endpoint: string, body: any, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function getJson(endpoint: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "GET",
    headers
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GET ${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function putJson(endpoint: string, body: any, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`PUT ${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function runE2E() {
  console.log("==================================================");
  console.log("🧪 RUNNING PROCTORAI PHASE 1 END-TO-END VERIFICATION");
  console.log("==================================================");

  // 1. Health Check
  console.log("\n[1/10] Testing Health Endpoint...");
  const healthRes = await getJson("/health");
  console.log("✅ Health Status:", healthRes.message);

  // 2. Candidate Registration
  const testEmail = `candidate_${Date.now()}@proctorai.local`;
  console.log(`\n[2/10] Registering Candidate (${testEmail})...`);
  const regRes = await postJson("/auth/register", {
    fullName: "E2E Test Candidate",
    email: testEmail,
    password: "Password@123"
  });
  const candidateToken = regRes.data.token;
  console.log("✅ Candidate Registered, Role:", regRes.data.user.role);

  // 3. Examiner Login
  console.log("\n[3/10] Logging in Examiner (examiner@proctorai.local)...");
  const loginRes = await postJson("/auth/login", {
    email: "examiner@proctorai.local",
    password: "ExaminerPass@123"
  });
  const examinerToken = loginRes.data.token;
  console.log("✅ Examiner Logged in, Role:", loginRes.data.user.role);

  // 4. Examiner Creates Exam
  console.log("\n[4/10] Examiner Creating New Exam...");
  const createExamRes = await postJson(
    "/exams",
    {
      title: `E2E Automated Assessment ${Date.now()}`,
      description: "Automated test to verify end-to-end examination lifecycle",
      durationMinutes: 30,
      totalMarks: 20
    },
    examinerToken
  );
  const examId = createExamRes.data.id;
  console.log(`✅ Exam Created: "${createExamRes.data.title}" (ID: ${examId})`);

  // 5. Examiner Adds MCQ Question
  console.log("\n[5/10] Examiner Adding MCQ Question...");
  const addQRes = await postJson(
    `/exams/${examId}/questions`,
    {
      questionText: "Which data structure follows LIFO (Last In First Out)?",
      questionType: "MCQ",
      marks: 10,
      options: [
        { optionText: "Queue", isCorrect: false },
        { optionText: "Stack", isCorrect: true },
        { optionText: "Array", isCorrect: false }
      ]
    },
    examinerToken
  );
  const questionId = addQRes.data.id;
  const correctOption = addQRes.data.options.find((o: any) => o.isCorrect);
  console.log(`✅ Question Added: ID ${questionId}, Correct Option ID: ${correctOption.id}`);

  // 6. Examiner Publishes Exam
  console.log("\n[6/10] Publishing Exam...");
  await putJson(
    `/exams/${examId}`,
    { status: "PUBLISHED" },
    examinerToken
  );
  console.log("✅ Exam Status updated to PUBLISHED");

  // 7. Candidate Starts Attempt
  console.log("\n[7/10] Candidate Starting Exam Attempt...");
  const startAttemptRes = await postJson(
    "/attempts",
    { examId },
    candidateToken
  );
  const attemptId = startAttemptRes.data.id;
  console.log(`✅ Attempt Initialized (ID: ${attemptId})`);

  // 8. Security Verification: Candidate cannot see isCorrect
  console.log("\n[8/10] Security Audit: Verifying candidate cannot see correct answer key...");
  const getAttemptRes = await getJson(`/attempts/${attemptId}`, candidateToken);
  const firstOption = getAttemptRes.data.exam.questions[0].options[0];
  if (firstOption.isCorrect !== undefined) {
    throw new Error("SECURITY LEAK: isCorrect was exposed to candidate before submission!");
  }
  console.log("🛡️ Passed: Options sent to candidate do not contain 'isCorrect'.");

  // 9. Candidate Saves Answer & Submits Exam
  console.log("\n[9/10] Candidate Answering Question & Submitting Attempt...");
  await postJson(
    `/attempts/${attemptId}/answers`,
    {
      questionId,
      selectedOptionId: correctOption.id
    },
    candidateToken
  );
  console.log("✅ Answer Autosaved");

  const submitRes = await postJson(
    `/attempts/${attemptId}/submit`,
    {},
    candidateToken
  );
  console.log(`✅ Exam Submitted! Final Status: ${submitRes.data.status}, Total Score: ${submitRes.data.totalScore} / 10`);

  // 10. Examiner Views Results
  console.log("\n[10/10] Examiner Auditing Exam Submissions...");
  const resultsRes = await getJson(`/attempts/exam/${examId}/results`, examinerToken);
  console.log(`✅ Examiner Retrieved ${resultsRes.data.length} candidate submission(s)`);
  console.log(`   - Candidate: ${resultsRes.data[0].candidate.fullName}`);
  console.log(`   - Candidate Score: ${resultsRes.data[0].totalScore}`);

  console.log("\n==================================================");
  console.log("🎉 ALL PHASE 1 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!");
  console.log("==================================================");
}

runE2E().catch((err) => {
  console.error("❌ E2E Test Failure:", err.message);
  process.exit(1);
});
