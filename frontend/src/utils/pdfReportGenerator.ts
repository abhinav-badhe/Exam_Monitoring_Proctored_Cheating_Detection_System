import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ExamAttempt, Exam } from "../types";

export interface GenerateReportOptions {
  exam: Exam;
  attempt: ExamAttempt;
  proctorEvents?: any[];
}

export function generateExamIntegrityPDF({ exam, attempt, proctorEvents = [] }: GenerateReportOptions) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const primaryColor: [number, number, number] = [30, 41, 59]; // Slate 800
  const accentColor: [number, number, number] = [79, 70, 229]; // Indigo 600
  const alertRose: [number, number, number] = [225, 29, 72]; // Rose 600
  const alertAmber: [number, number, number] = [217, 119, 6]; // Amber 600
  const alertGreen: [number, number, number] = [16, 185, 129]; // Emerald 500

  // 1. Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("PROCTORAI | EXAMINATION INTEGRITY & AUDIT REPORT", 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text("Multi-Modal Proctored Assessment Telemetry, Anomaly Evaluation & Examiner Sign-Off", 14, 22);
  doc.text(`Generated: ${new Date().toLocaleString()} | Audit Ref: ${attempt.id.slice(0, 8).toUpperCase()}`, 14, 27);

  // 2. Candidate & Exam Details Table
  doc.setTextColor(...primaryColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("1. Examination & Candidate Profile", 14, 42);

  const latestScore = attempt.scores && attempt.scores.length > 0 ? attempt.scores[0] : null;
  const latestReview = attempt.reviews && attempt.reviews.length > 0 ? attempt.reviews[0] : null;
  const totalScoreVal = attempt.totalScore ?? 0;
  const percentage = exam.totalMarks > 0 ? ((totalScoreVal / exam.totalMarks) * 100).toFixed(1) : "0.0";

  autoTable(doc, {
    startY: 46,
    theme: "striped",
    headStyles: { fillColor: accentColor, textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: 30 },
    head: [["Field", "Examination Parameter", "Candidate Information"]],
    body: [
      ["Candidate Name", exam.title, attempt.candidate?.fullName || "Candidate"],
      ["Email Address", `Duration: ${exam.durationMinutes} Minutes`, attempt.candidate?.email || "N/A"],
      ["Examination ID", attempt.examId, `Attempt ID: ${attempt.id}`],
      ["Start & Submit Time", `Started: ${new Date(attempt.startedAt).toLocaleTimeString()}`, `Submitted: ${attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleTimeString() : "In Progress"}`],
      ["Academic Score", `Maximum Marks: ${exam.totalMarks}`, `Awarded: ${totalScoreVal} / ${exam.totalMarks} (${percentage}%)`]
    ]
  });

  // 3. Behavioural Anomaly & Risk Evaluation
  let currentY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text("2. AI Behavioural Anomaly & Risk Evaluation", 14, currentY);

  const riskTier = latestScore?.riskLevel || "LOW";
  const numScore = latestScore?.score !== undefined ? latestScore.score.toFixed(1) : "N/A";
  const ruleExplanation = (latestScore?.explanation as any) || {};

  autoTable(doc, {
    startY: currentY + 4,
    theme: "grid",
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    head: [["Metric", "Value", "Proctoring Evaluation Details"]],
    body: [
      ["Overall Risk Tier", `${riskTier} (${numScore}/100.0)`, "Blended multi-signal correlation score (65% Rules + 35% Isolation Forest)"],
      ["Isolation Forest ML Score", `${ruleExplanation.mlIsolationForestScore !== undefined ? ruleExplanation.mlIsolationForestScore + '/100.0' : 'Evaluated'}`, "Unsupervised statistical deviation from benign baseline candidate telemetry"],
      ["Rule Engine Violations", `${ruleExplanation.ruleViolations?.length || 0} Rule(s) Triggered`, ruleExplanation.ruleViolations?.map((v: any) => v.rule).join(", ") || "None (Clean baseline)"],
      ["Monitored Multi-Signals", "Browser, Webcam, OCR, Audio", "Window focus, gaze direction, phone presence, external AI assistant, speech"]
    ]
  });

  // 4. Human Examiner Review Verdict
  currentY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text("3. Official Human Examiner Verdict & Audit Record", 14, currentY);

  const verdict = latestReview?.decision || "UNREVIEWED";
  const reviewerName = latestReview?.reviewer?.fullName || "Institutional Examiner";
  const reviewerNotes = latestReview?.notes || "No additional examiner notes provided.";

  autoTable(doc, {
    startY: currentY + 4,
    theme: "plain",
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    body: [
      ["Official Human Decision:", `${verdict}`],
      ["Reviewed By:", `${reviewerName} (${latestReview?.reviewer?.email || "Examiner"})`],
      ["Review Date:", `${latestReview?.createdAt ? new Date(latestReview.createdAt).toLocaleString() : "Pending final human review"}`],
      ["Examiner Justification Notes:", `${reviewerNotes}`]
    ]
  });

  // 5. Recent Chronological Incident Timeline
  if (proctorEvents && proctorEvents.length > 0) {
    currentY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text("4. Chronological Incident Log (High & Critical Telemetry)", 14, currentY);

    const flaggedEvents = proctorEvents
      .filter((e) => e.severity === "HIGH" || e.severity === "CRITICAL" || e.severity === "MEDIUM")
      .slice(0, 10);

    const tableRows = flaggedEvents.map((evt) => [
      new Date(evt.createdAt).toLocaleTimeString(),
      evt.eventType,
      evt.severity,
      JSON.stringify(evt.metadata || {})
    ]);

    if (tableRows.length > 0) {
      autoTable(doc, {
        startY: currentY + 4,
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: 40 },
        head: [["Time", "Event Code", "Severity", "Context Details"]],
        body: tableRows
      });
    }
  }

  // 6. Regulatory Sign-Off Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Notice: ProctorAI anomaly scores serve as explainable audit aids for human examiner review; not autonomous proof of misconduct. Compliant with FERPA & GDPR standards.",
    14,
    pageHeight - 8
  );

  // Save PDF
  const filename = `ProctorAI_Audit_${exam.title.replace(/[^a-zA-Z0-9]/g, "_")}_${(attempt.candidate?.fullName || "Candidate").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
}
