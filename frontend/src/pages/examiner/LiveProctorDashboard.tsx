import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { examService } from "../../services/exam.service";
import { attemptService } from "../../services/attempt.service";
import { getSocket } from "../../services/socket.service";
import { Exam, ExamAttempt } from "../../types";

interface LiveAlert {
  id: string;
  attemptId: string;
  candidateName: string;
  candidateEmail: string;
  eventType: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  timestamp: string;
  metadata?: any;
}

export const LiveProctorDashboard: React.FC = () => {
  const { id: examId } = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Direct Warning Modal state
  const [warningModalCandidate, setWarningModalCandidate] = useState<{ attemptId: string; name: string } | null>(null);
  const [warningMessage, setWarningMessage] = useState("");
  const [warningSuccess, setWarningSuccess] = useState("");

  // Review Verdict Modal state
  const [reviewModalAttempt, setReviewModalAttempt] = useState<ExamAttempt | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"CLEARED" | "FLAGGED_FOR_INQUIRY" | "DISQUALIFIED">("FLAGGED_FOR_INQUIRY");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Track latest focus states per attempt
  const [candidateStates, setCandidateStates] = useState<Record<string, {
    isFocused: boolean;
    lastEventTime?: string;
    faceStatus: "NORMAL" | "LOOKING_AWAY" | "NO_FACE" | "MULTI_FACE";
    phoneDetected: boolean;
    externalToolDetected: boolean;
  }>>({});

  const alertFeedEndRef = useRef<HTMLDivElement>(null);

  // Play subtle warning chime for high/critical alerts
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {
      // Audio context maybe blocked by autoplay policy
    }
  };

  const loadData = async () => {
    if (!examId) return;
    try {
      setLoading(true);
      const [examData, attemptsData] = await Promise.all([
        examService.getExamById(examId),
        attemptService.getExamResults(examId)
      ]);
      setExam(examData);
      setAttempts(attemptsData);

      // Initialize candidate states
      const initialStates: typeof candidateStates = {};
      for (const att of attemptsData) {
        initialStates[att.id] = {
          isFocused: true,
          faceStatus: "NORMAL",
          phoneDetected: false,
          externalToolDetected: false
        };
      }
      setCandidateStates(initialStates);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load live proctoring data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (!examId) return;
    const socket = getSocket();

    // Join room for this exam
    socket.emit("join:exam", examId);

    // Listen for live proctor alerts broadcast by the backend
    socket.on("exam:proctor_alert", (data: any) => {
      const newAlert: LiveAlert = {
        id: `alert_${Date.now()}_${Math.random()}`,
        attemptId: data.attemptId,
        candidateName: data.candidate?.fullName || "Candidate",
        candidateEmail: data.candidate?.email || "",
        eventType: data.eventType,
        severity: data.severity,
        description: data.metadata?.description || data.eventType,
        timestamp: data.createdAt || new Date().toISOString(),
        metadata: data.metadata
      };

      setAlerts((prev) => [newAlert, ...prev.slice(0, 99)]);

      if (data.severity === "HIGH" || data.severity === "CRITICAL") {
        playAlertSound();
      }

      // Update candidate live telemetry state
      setCandidateStates((prev) => {
        const current = prev[data.attemptId] || {
          isFocused: true,
          faceStatus: "NORMAL",
          phoneDetected: false,
          externalToolDetected: false
        };

        const updated = { ...current, lastEventTime: new Date().toLocaleTimeString() };

        if (data.eventType === "WINDOW_BLUR" || data.eventType === "TAB_HIDDEN" || data.eventType === "FULLSCREEN_EXIT") {
          updated.isFocused = false;
        } else if (data.eventType === "WINDOW_FOCUS" || data.eventType === "TAB_VISIBLE") {
          updated.isFocused = true;
        }

        if (data.eventType === "NO_FACE_DETECTED") {
          updated.faceStatus = "NO_FACE";
        } else if (data.eventType === "MULTIPLE_FACES_DETECTED") {
          updated.faceStatus = "MULTI_FACE";
        } else if (data.eventType === "LOOKING_AWAY") {
          updated.faceStatus = "LOOKING_AWAY";
        } else if (data.eventType === "FACE_CENTERED") {
          updated.faceStatus = "NORMAL";
        }

        if (data.eventType === "PHONE_DETECTED") {
          updated.phoneDetected = true;
        }

        if (data.eventType === "EXTERNAL_AI_INDICATOR" || data.eventType === "UNAUTHORIZED_RESOURCE_INDICATOR") {
          updated.externalToolDetected = true;
        }

        return { ...prev, [data.attemptId]: updated };
      });
    });

    return () => {
      socket.emit("leave:exam", examId);
      socket.off("exam:proctor_alert");
    };
  }, [examId]);

  const handleSendWarning = () => {
    if (!warningModalCandidate || !warningMessage.trim() || !examId) return;

    const socket = getSocket();
    socket.emit("examiner:warn_candidate", {
      attemptId: warningModalCandidate.attemptId,
      examId,
      warningMessage: warningMessage.trim()
    });

    setWarningSuccess(`Direct warning dispatched to ${warningModalCandidate.name}`);
    setTimeout(() => {
      setWarningSuccess("");
      setWarningModalCandidate(null);
      setWarningMessage("");
    }, 1800);
  };

  const handleRecordReview = async () => {
    if (!reviewModalAttempt) return;
    try {
      setReviewSubmitting(true);
      await attemptService.createReview(reviewModalAttempt.id, {
        decision: reviewDecision,
        notes: reviewNotes.trim()
      });
      // Refresh attempt data to reflect updated reviews
      await loadData();
      setReviewModalAttempt(null);
      setReviewNotes("");
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to record review verdict");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-950/80 text-red-300 border border-red-700 animate-pulse">CRITICAL</span>;
      case "HIGH":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-950/70 text-orange-300 border border-orange-700">HIGH</span>;
      case "MEDIUM":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-700">MEDIUM</span>;
      case "LOW":
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-950/60 text-blue-300 border border-blue-800">LOW</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300">INFO</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Connecting to Real-Time Proctoring Stream...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <Link
            to={`/examiner/exams/${examId}`}
            className="text-slate-400 hover:text-slate-200 text-sm flex items-center transition"
          >
            ← Back to Exam
          </Link>
          <div className="h-5 w-[1px] bg-slate-700"></div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold tracking-tight text-white">{exam?.title}</h1>
              <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-600/60">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>LIVE PROCTORING ACTIVE</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Duration: {exam?.durationMinutes} mins | Total Questions: {exam?.questions?.length || 0}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center space-x-1.5 ${
              soundEnabled
                ? "bg-indigo-950/60 text-indigo-300 border-indigo-700"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
            title="Toggle alert chime"
          >
            <span>{soundEnabled ? "🔔 Chime Active" : "🔕 Chime Muted"}</span>
          </button>
          <Link
            to={`/examiner/exams/${examId}/results`}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            📊 View Full Results & Scores
          </Link>
        </div>
      </header>

      {/* Main Grid View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 overflow-hidden">
        {/* Candidates Panel (2 Cols) */}
        <div className="lg:col-span-2 flex flex-col space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-200 flex items-center space-x-2">
              <span>👥 Active Candidates</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-400">
                {attempts.length} candidate(s)
              </span>
            </h2>
            <button
              onClick={loadData}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition"
            >
              🔄 Refresh List
            </button>
          </div>

          {attempts.length === 0 ? (
            <div className="p-12 text-center border border-slate-800 rounded-xl bg-slate-900/40 text-slate-400">
              <p>No candidates have initiated an attempt for this examination yet.</p>
              <p className="text-xs text-slate-500 mt-1">
                Candidate live cards will appear here as soon as tests begin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attempts.map((att) => {
                const state = candidateStates[att.id] || {
                  isFocused: true,
                  faceStatus: "NORMAL",
                  phoneDetected: false,
                  externalToolDetected: false
                };
                const latestScore = att.scores && att.scores[0];
                const latestReview = att.reviews && att.reviews[0];

                return (
                  <div
                    key={att.id}
                    className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
                  >
                    {/* Header */}
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-white text-base">
                            {att.candidate?.fullName || "Candidate"}
                          </h3>
                          <p className="text-xs text-slate-400">{att.candidate?.email}</p>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            att.status === "IN_PROGRESS"
                              ? "bg-emerald-950/70 text-emerald-300 border border-emerald-700"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {att.status}
                        </span>
                      </div>

                      {/* Status Indicators */}
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                          <span className="text-slate-400">Tab Focus</span>
                          {state.isFocused ? (
                            <span className="text-emerald-400 font-medium">● Focused</span>
                          ) : (
                            <span className="text-rose-400 font-bold animate-pulse">▲ Switched</span>
                          )}
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                          <span className="text-slate-400">Face State</span>
                          {state.faceStatus === "NORMAL" && (
                            <span className="text-emerald-400 font-medium">● Centered</span>
                          )}
                          {state.faceStatus === "LOOKING_AWAY" && (
                            <span className="text-amber-400 font-medium">Looking Away</span>
                          )}
                          {state.faceStatus === "NO_FACE" && (
                            <span className="text-rose-400 font-bold">Face Missing</span>
                          )}
                          {state.faceStatus === "MULTI_FACE" && (
                            <span className="text-red-400 font-bold">Multi-Face</span>
                          )}
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                          <span className="text-slate-400">Mobile Device</span>
                          {state.phoneDetected ? (
                            <span className="text-rose-400 font-bold animate-pulse">DETECTED</span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </div>

                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                          <span className="text-slate-400">Screen OCR AI</span>
                          {state.externalToolDetected ? (
                            <span className="text-rose-400 font-bold animate-pulse">FLAGGED</span>
                          ) : (
                            <span className="text-slate-400">Clear</span>
                          )}
                        </div>
                      </div>

                      {/* Anomaly & Human Review Verdict Badges */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {latestScore && (
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              latestScore.riskLevel === "CRITICAL"
                                ? "bg-red-950 text-red-300 border border-red-700"
                                : latestScore.riskLevel === "HIGH"
                                ? "bg-orange-950 text-orange-300 border border-orange-700"
                                : latestScore.riskLevel === "MEDIUM"
                                ? "bg-amber-950 text-amber-300 border border-amber-700"
                                : "bg-emerald-950 text-emerald-300 border border-emerald-700"
                            }`}
                          >
                            Risk: {latestScore.riskLevel} ({latestScore.score.toFixed(1)})
                          </span>
                        )}

                        {latestReview ? (
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              latestReview.decision === "CLEARED"
                                ? "bg-emerald-950/90 text-emerald-300 border border-emerald-600"
                                : latestReview.decision === "DISQUALIFIED"
                                ? "bg-red-950/90 text-red-300 border border-red-600"
                                : "bg-amber-950/90 text-amber-300 border border-amber-600"
                            }`}
                          >
                            Verdict: {latestReview.decision}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400 border border-slate-700">
                            Unreviewed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Examiner Action Buttons */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setWarningModalCandidate({
                            attemptId: att.id,
                            name: att.candidate?.fullName || "Candidate"
                          });
                          setWarningMessage("Please keep your eyes focused on your screen and exam interface.");
                        }}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 border border-amber-700 transition"
                      >
                        ⚠️ Issue Warning
                      </button>

                      <button
                        onClick={() => {
                          setReviewModalAttempt(att);
                          setReviewDecision("CLEARED");
                          setReviewNotes("");
                        }}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-700 transition"
                      >
                        ⚖️ Record Verdict
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Proctoring Alerts Stream (1 Col) */}
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4 h-full overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <h2 className="text-sm font-semibold text-white">Live Alert Stream</h2>
            </div>
            <span className="text-xs text-slate-400">{alerts.length} event(s)</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1 text-xs">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p>Waiting for proctoring events...</p>
                <p className="text-[11px] mt-1">
                  Browser activity, CV alerts, and OCR indicators will stream here in real-time.
                </p>
              </div>
            ) : (
              alerts.map((al) => (
                <div
                  key={al.id}
                  className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 space-y-1.5 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 truncate max-w-[140px]">
                      {al.candidateName}
                    </span>
                    {getSeverityBadge(al.severity)}
                  </div>

                  <p className="text-slate-300 font-medium">{al.description}</p>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                    <span className="font-mono">{al.eventType}</span>
                    <span>{new Date(al.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
            <div ref={alertFeedEndRef} />
          </div>
        </div>
      </div>

      {/* Direct Warning Modal */}
      {warningModalCandidate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>⚠️ Issue Direct Warning</span>
              </h3>
              <button
                onClick={() => setWarningModalCandidate(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Send an immediate high-priority proctoring alert to{" "}
              <span className="font-semibold text-white">{warningModalCandidate.name}</span>'s active screen.
            </p>

            {/* Preset shortcuts */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400">Quick Presets:</label>
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setWarningMessage("Please keep your eyes focused on your screen and exam interface.")}
                  className="text-left px-3 py-1.5 rounded bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/60 transition"
                >
                  👀 Focus on exam screen
                </button>
                <button
                  type="button"
                  onClick={() => setWarningMessage("Ensure your face is centered and fully visible within camera frame.")}
                  className="text-left px-3 py-1.5 rounded bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/60 transition"
                >
                  📷 Center face in camera
                </button>
                <button
                  type="button"
                  onClick={() => setWarningMessage("Close unauthorized browser windows and external apps immediately.")}
                  className="text-left px-3 py-1.5 rounded bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/60 transition"
                >
                  🚫 Close unauthorized windows
                </button>
                <button
                  type="button"
                  onClick={() => setWarningMessage("Put away all mobile phones or electronic devices.")}
                  className="text-left px-3 py-1.5 rounded bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/60 transition"
                >
                  📱 Put away mobile device
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Warning Message:</label>
              <textarea
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                rows={3}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                placeholder="Type instructions or warning for candidate..."
              ></textarea>
            </div>

            {warningSuccess && (
              <p className="text-xs text-emerald-400 font-semibold">{warningSuccess}</p>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setWarningModalCandidate(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendWarning}
                disabled={!warningMessage.trim()}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50"
              >
                Send Warning Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Verdict Modal */}
      {reviewModalAttempt && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>⚖️ Record Human Review Verdict</span>
              </h3>
              <button
                onClick={() => setReviewModalAttempt(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Record official human review decision for candidate{" "}
              <span className="font-semibold text-white">
                {reviewModalAttempt.candidate?.fullName || "Candidate"}
              </span>.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Review Decision:</label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setReviewDecision("CLEARED")}
                  className={`py-2 px-3 rounded-lg border font-semibold transition ${
                    reviewDecision === "CLEARED"
                      ? "bg-emerald-950 text-emerald-300 border-emerald-600 ring-2 ring-emerald-500/30"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  ✅ Cleared
                </button>
                <button
                  type="button"
                  onClick={() => setReviewDecision("FLAGGED_FOR_INQUIRY")}
                  className={`py-2 px-3 rounded-lg border font-semibold transition ${
                    reviewDecision === "FLAGGED_FOR_INQUIRY"
                      ? "bg-amber-950 text-amber-300 border-amber-600 ring-2 ring-amber-500/30"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  ⚠️ Flag Inquiry
                </button>
                <button
                  type="button"
                  onClick={() => setReviewDecision("DISQUALIFIED")}
                  className={`py-2 px-3 rounded-lg border font-semibold transition ${
                    reviewDecision === "DISQUALIFIED"
                      ? "bg-red-950 text-red-300 border-red-600 ring-2 ring-red-500/30"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  🚫 Disqualify
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Examiner Justification Notes:</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                placeholder="Detail rationale, audited evidence, or clear exoneration explanation..."
              ></textarea>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setReviewModalAttempt(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordReview}
                disabled={reviewSubmitting}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
              >
                {reviewSubmitting ? "Saving Verdict..." : "Save Review Decision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
