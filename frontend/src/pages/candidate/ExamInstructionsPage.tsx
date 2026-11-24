import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { examService } from "../../services/exam.service";
import { attemptService } from "../../services/attempt.service";
import { Exam } from "../../types";
import { scanForActiveExtensions, ExtensionScanResult } from "../../utils/extensionDetector";
import { ArrowLeft, Clock, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, AlertCircle, RefreshCw, XCircle } from "lucide-react";

export const ExamInstructionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // System & Extension Readiness Check state
  const [extensionCheck, setExtensionCheck] = useState<ExtensionScanResult>({
    hasExtensions: false,
    detectedExtensions: [],
    details: []
  });
  const [scanning, setScanning] = useState(false);

  // Consent checkboxes
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeMonitoring, setAgreeMonitoring] = useState(false);

  const navigate = useNavigate();

  const runExtensionScan = () => {
    setScanning(true);
    // Allow slight timeout for any content scripts to settle
    setTimeout(() => {
      const result = scanForActiveExtensions();
      setExtensionCheck(result);
      setScanning(false);
    }, 400);
  };

  useEffect(() => {
    const fetchExam = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await examService.getExamById(id);
        setExam(data);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load examination instructions");
      } finally {
        setLoading(false);
      }
    };

    fetchExam();
    runExtensionScan();
  }, [id]);

  const handleStartExam = async () => {
    // Re-verify right before launching
    const recheck = scanForActiveExtensions();
    if (recheck.hasExtensions) {
      setExtensionCheck(recheck);
      setError("Cannot begin examination: One or more active browser extensions were detected. Please disable them to proceed.");
      return;
    }

    if (!id || !agreeTerms || !agreeMonitoring) return;
    setError(null);
    setStarting(true);

    try {
      const attempt = await attemptService.startAttempt(id);
      navigate(`/candidate/exam/${attempt.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to start examination attempt");
      setStarting(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500">Loading exam guidelines...</div>;
  }

  if (!exam) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-center text-rose-500">Exam not found or inactive</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/candidate"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Available Exams
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8">
        {/* Header */}
        <div className="pb-6 border-b border-slate-200">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
            Online Proctored Assessment
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{exam.title}</h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {exam.description || "Read the rules below carefully before launching the test environment."}
          </p>
        </div>

        {error && (
          <div className="mt-6 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Exam Specifications */}
        <div className="grid grid-cols-3 gap-4 my-6">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <Clock className="w-5 h-5 mx-auto text-blue-600 mb-1" />
            <p className="text-xs text-slate-500 uppercase font-medium">Duration</p>
            <p className="text-lg font-bold text-slate-900">{exam.durationMinutes} Mins</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-xs text-slate-500 uppercase font-medium">Questions</p>
            <p className="text-lg font-bold text-slate-900">{exam.questions?.length || 0}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
            <ShieldCheck className="w-5 h-5 mx-auto text-purple-600 mb-1" />
            <p className="text-xs text-slate-500 uppercase font-medium">Total Marks</p>
            <p className="text-lg font-bold text-slate-900">{exam.totalMarks}</p>
          </div>
        </div>

        {/* Proctoring & Integrity Guidelines */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 mb-6 text-sm text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Rules & Examination Integrity Policy
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-amber-800 leading-relaxed">
            <li>The test timer starts immediately once you click "Begin Examination" and cannot be paused.</li>
            <li>Do not switch tabs, minimize the browser window, or exit fullscreen mode.</li>
            <li>Clipboard operations (Copying and Pasting) are monitored and logged.</li>
            <li>Your answers are automatically saved as you select them.</li>
            <li>Upon time expiry, your exam will automatically submit.</li>
          </ul>
        </div>

        {/* Pre-Exam Environment & Browser Extension Audit */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Environment & Extension Pre-Check
            </h3>
            <button
              type="button"
              onClick={runExtensionScan}
              disabled={scanning}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Scanning..." : "Re-scan Environment"}
            </button>
          </div>

          {extensionCheck.hasExtensions ? (
            <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-rose-950">
                    Active Browser Extension Detected — Action Required
                  </h4>
                  <p className="text-xs text-rose-800 mt-0.5">
                    Proctored assessment rules strictly prohibit all third-party browser extensions, sidebars, and AI assistants. You cannot start the exam until these are disabled.
                  </p>
                </div>
              </div>

              {/* Detected List */}
              <div className="p-3 bg-white/80 rounded-lg border border-rose-200 space-y-1.5 text-xs">
                <p className="font-semibold text-rose-950">Detected Extension(s):</p>
                <ul className="list-disc list-inside space-y-0.5 text-rose-800 font-medium">
                  {extensionCheck.detectedExtensions.map((ext, idx) => (
                    <li key={idx}>
                      <span className="font-bold">{ext.name}</span> ({ext.category}) — <span className="text-slate-500 text-2xs">{ext.signature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Instructions on how to disable */}
              <div className="p-3 bg-rose-100/60 rounded-lg text-xs text-rose-900 space-y-1">
                <p className="font-bold">How to resolve:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-rose-800">
                  <li>Open your browser extensions settings (e.g. <code className="bg-white px-1 py-0.5 rounded text-rose-900 font-mono">chrome://extensions</code> or <code className="bg-white px-1 py-0.5 rounded text-rose-900 font-mono">edge://extensions</code>).</li>
                  <li>Toggle off active AI, translation, writing, or assistant extensions.</li>
                  <li>Alternatively, open this exam URL in an <strong>Incognito / Guest Window</strong> with extensions disabled.</li>
                  <li>Return to this page and click <strong>"Re-scan Environment"</strong> above.</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">
                  <strong>Browser Environment Clean:</strong> No active extensions or injected AI tools detected.
                </span>
              </div>
              <span className="text-2xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">
                Verified
              </span>
            </div>
          )}
        </div>

        {/* Informed Consent Checkboxes */}
        <div className="space-y-3 pt-2 pb-6 border-b border-slate-100">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500 border-slate-300"
            />
            <span className="text-xs text-slate-700 leading-relaxed">
              I certify that I am the registered candidate and will complete this examination independently without unauthorized materials or external assistance.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeMonitoring}
              onChange={(e) => setAgreeMonitoring(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500 border-slate-300"
            />
            <span className="text-xs text-slate-700 leading-relaxed">
              I consent to session activity monitoring (browser visibility, focus state, and interaction telemetry) for the duration of this exam attempt.
            </span>
          </label>
        </div>

        {/* Action Button */}
        <div className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-slate-500">
            {extensionCheck.hasExtensions ? (
              <span className="text-rose-600 font-semibold">
                ⚠️ You must disable all active extensions before beginning this exam.
              </span>
            ) : !agreeTerms || !agreeMonitoring ? (
              <span>Please review guidelines and check both certifications to proceed.</span>
            ) : (
              <span className="text-emerald-600 font-semibold">Environment verified. Ready to begin.</span>
            )}
          </p>

          <button
            onClick={handleStartExam}
            disabled={!agreeTerms || !agreeMonitoring || extensionCheck.hasExtensions || starting}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {starting ? "Launching Environment..." : extensionCheck.hasExtensions ? "Extensions Must Be Disabled" : "Begin Examination"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
