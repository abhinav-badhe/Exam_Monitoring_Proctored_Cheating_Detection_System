import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { attemptService } from "../../services/attempt.service";
import { getSocket } from "../../services/socket.service";
import { useProctorMonitor } from "../../hooks/useProctorMonitor";
import { WebcamMonitor } from "../../components/exam/WebcamMonitor";
import { ScreenMonitor } from "../../components/exam/ScreenMonitor";
import { AudioMonitor } from "../../components/exam/AudioMonitor";
import { ExamAttempt, Question } from "../../types";
import { scanForActiveExtensions } from "../../utils/extensionDetector";
import { Clock, ShieldCheck, ChevronLeft, ChevronRight, AlertCircle, Maximize2, AlertTriangle, ShieldAlert, XCircle } from "lucide-react";

export const ExamInterfacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraWarning, setCameraWarning] = useState<string | null>(null);
  const [examinerWarning, setExaminerWarning] = useState<{ message: string; sentBy: string } | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenReason, setFrozenReason] = useState<string | null>(null);

  const navigate = useNavigate();
  const timerRef = useRef<any>(null);

  const playProctorChime = (type: "warning" | "resume") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      if (type === "warning") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      }
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (type === "warning" ? 0.35 : 0.3));
    } catch {
      // Audio context might be restricted
    }
  };

  // Module 2 & 4: Active Browser & Screen Proctor Monitoring
  const {
    isFullscreen,
    enterFullscreen,
    activeWarning,
    loggedEventsCount,
    extensionBlockMessage,
    clearExtensionBlock,
    logCustomEvent
  } = useProctorMonitor({
    attemptId: id || null,
    enabled: !!attempt && attempt.status === "IN_PROGRESS"
  });

  const displayWarning = activeWarning || cameraWarning;

  useEffect(() => {
    const fetchAttempt = async () => {
      if (!id) return;
      try {
        const data = await attemptService.getAttempt(id);
        setAttempt(data);

        // Prepopulate existing answers
        const ansMap: Record<string, string> = {};
        data.answers.forEach((ans) => {
          if (ans.selectedOptionId) {
            ansMap[ans.questionId] = ans.selectedOptionId;
          }
        });
        setSelectedAnswers(ansMap);

        // Set countdown
        setTimeLeft(data.remainingSeconds || data.exam.durationMinutes * 60);

        // Populate initial frozen state
        setIsFrozen(!!data.isFrozen);
        setFrozenReason(data.frozenReason || null);

        // If already submitted, redirect to result
        if (data.status === "SUBMITTED" || data.status === "AUTO_SUBMITTED" || data.status === "EVALUATED") {
          navigate(`/candidate/results/${id}`, { replace: true });
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load examination attempt");
      }
    };

    fetchAttempt();
  }, [id, navigate]);

  // Real-Time Socket Connection for Proctor Warnings & Interventions
  useEffect(() => {
    if (!id || !attempt || attempt.status !== "IN_PROGRESS") return;

    const socket = getSocket();
    socket.emit("join:attempt", id);

    socket.on("candidate:warning", (data: any) => {
      playProctorChime("warning");
      setExaminerWarning({
        message: data.warningMessage,
        sentBy: data.sentBy || "Human Examiner"
      });
    });

    socket.on("candidate:session_frozen", (data: any) => {
      playProctorChime("warning");
      setIsFrozen(true);
      setFrozenReason(data.reason || "Exam session paused by proctor for integrity check.");
    });

    socket.on("candidate:session_resumed", () => {
      playProctorChime("resume");
      setIsFrozen(false);
      setFrozenReason(null);
    });

    socket.on("candidate:force_submitted", (data: any) => {
      playProctorChime("warning");
      navigate(`/candidate/results/${id}`, {
        replace: true,
        state: { forced: true, reason: data.reason, disqualified: data.disqualified }
      });
    });

    return () => {
      socket.emit("leave:attempt", id);
      socket.off("candidate:warning");
      socket.off("candidate:session_frozen");
      socket.off("candidate:session_resumed");
      socket.off("candidate:force_submitted");
    };
  }, [id, attempt?.status]);

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (extensionBlockMessage || isFrozen) return prev; // Pause countdown while examination is blocked by active extension or frozen by proctor
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft]);

  const handleAutoSubmit = async () => {
    if (!id || submitting) return;
    setSubmitting(true);
    try {
      await attemptService.submitAttempt(id);
      navigate(`/candidate/results/${id}`, { replace: true });
    } catch {
      navigate(`/candidate/results/${id}`, { replace: true });
    }
  };

  const handleOptionSelect = async (questionId: string, optionId: string) => {
    if (!id || submitting || isFrozen) return;

    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    setSavingStatus("saving");

    try {
      await attemptService.saveAnswer(id, {
        questionId,
        selectedOptionId: optionId
      });
      setSavingStatus("saved");
    } catch (err) {
      console.error("Autosave error:", err);
      setSavingStatus("idle");
    }
  };

  const handleSubmitExam = async () => {
    if (!id || submitting || isFrozen) return;
    setSubmitting(true);
    try {
      await attemptService.submitAttempt(id);
      navigate(`/candidate/results/${id}`, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit examination");
      setSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!attempt) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-medium text-slate-600">Preparing examination environment...</p>
        </div>
      </div>
    );
  }

  const questions: Question[] = attempt.exam.questions || [];
  const currentQuestion: Question | undefined = questions[currentIndex];
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Test Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="font-bold text-base text-slate-900 leading-tight">{attempt.exam.title}</h1>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
            <span className="flex items-center gap-1 font-medium text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" /> Proctoring Active
            </span>
            <span>•</span>
            <span>
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span>•</span>
            <span className="italic text-slate-400">
              {savingStatus === "saving" && "Saving answer..."}
              {savingStatus === "saved" && "Response saved"}
            </span>
          </div>
        </div>

        {/* Live Timer, Fullscreen, Screen Share, & Finish Button */}
        <div className="flex items-center gap-3">
          {id && (
            <ScreenMonitor
              attemptId={id}
              enabled={!!attempt && attempt.status === "IN_PROGRESS"}
              onAnomaly={(msg) => {
                setCameraWarning(msg);
                setTimeout(() => setCameraWarning(null), 5000);
              }}
              onLogEvent={logCustomEvent}
            />
          )}

          {!isFullscreen && (
            <button
              onClick={enterFullscreen}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-semibold text-xs rounded-lg transition"
              title="Enter Fullscreen Mode"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Fullscreen
            </button>
          )}

          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-mono font-bold text-sm ${
              timeLeft !== null && timeLeft < 300
                ? "bg-rose-50 border-rose-300 text-rose-700 animate-pulse"
                : "bg-slate-50 border-slate-300 text-slate-800"
            }`}
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>{timeLeft !== null ? formatTimer(timeLeft) : "--:--"}</span>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-xs transition"
          >
            Submit Examination
          </button>
        </div>
      </header>

      {/* Floating Active Warning Banner */}
      {displayWarning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-xl w-full px-4 animate-bounce">
          <div className="bg-rose-600 text-white p-3.5 rounded-xl shadow-lg border border-rose-700 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-semibold leading-relaxed">{displayWarning}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="m-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Examination Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Current Question */}
        <div className="lg:col-span-3 flex flex-col justify-between bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          {currentQuestion ? (
            <div>
              {/* Question Meta */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 rounded-md">
                  Question {currentIndex + 1}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Worth: {currentQuestion.marks} marks
                </span>
              </div>

              {/* Question Text */}
              <div className="my-6">
                <h2 className="text-lg font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {currentQuestion.questionText}
                </h2>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((opt) => {
                  const isSelected = selectedAnswers[currentQuestion.id] === opt.id;
                  return (
                    <label
                      key={opt.id}
                      onClick={() => handleOptionSelect(currentQuestion.id, opt.id)}
                      className={`flex items-center gap-3.5 p-4 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? "bg-blue-50/70 border-blue-600 ring-1 ring-blue-600 text-blue-900 font-medium"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm select-none">{opt.optionText}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-slate-500">No questions found in this assessment.</p>
          )}

          {/* Bottom Navigation Buttons */}
          <div className="pt-6 mt-8 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <span className="text-xs text-slate-400">
              {answeredCount} of {questions.length} answered
            </span>

            <button
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-40"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Question Navigator Palette */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
            Question Palette
          </h3>

          <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-2">
            {questions.map((q, idx) => {
              const isAnswered = !!selectedAnswers[q.id];
              const isCurrent = idx === currentIndex;

              let btnClasses = "h-10 text-xs font-bold rounded-lg border transition flex items-center justify-center ";
              if (isCurrent) {
                btnClasses += "ring-2 ring-blue-600 border-blue-600 bg-blue-50 text-blue-800 ";
              } else if (isAnswered) {
                btnClasses += "bg-emerald-50 border-emerald-300 text-emerald-800 ";
              } else {
                btnClasses += "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 ";
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={btnClasses}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-emerald-50 border border-emerald-300"></div>
              <span>Answered ({answeredCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-slate-50 border border-slate-200"></div>
              <span>Unanswered ({questions.length - answeredCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-blue-50 border-2 border-blue-600"></div>
              <span>Current Question</span>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Confirm Exam Submission</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              You have answered <strong>{answeredCount}</strong> out of <strong>{questions.length}</strong> questions.
              {answeredCount < questions.length && (
                <span className="block mt-1 text-amber-600 font-medium text-xs">
                  Warning: You still have {questions.length - answeredCount} unanswered question(s).
                </span>
              )}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Once submitted, your attempt is final and your answers will be automatically graded.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Return to Exam
              </button>
              <button
                type="button"
                onClick={handleSubmitExam}
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-50"
              >
                {submitting ? "Finalizing..." : "Yes, Submit Exam"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Exam Active Browser Extension Blocking Modal */}
      {extensionBlockMessage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-rose-950/95 border-2 border-rose-500 rounded-2xl p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-rose-600 rounded-full animate-bounce">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                  EXAMINATION PAUSED: EXTENSION DETECTED
                </h3>
                <p className="text-xs text-rose-200">Security Rule Violation</p>
              </div>
            </div>

            <div className="p-3.5 bg-black/50 border border-rose-800 rounded-xl text-xs text-rose-100 space-y-1">
              <p className="font-semibold text-rose-300">Trigger Details:</p>
              <p className="font-mono text-xs">{extensionBlockMessage}</p>
            </div>

            <p className="text-xs text-rose-200">
              Proctored assessment integrity rules strictly forbid running third-party browser extensions or injected assistant tools during the examination.
            </p>

            <div className="p-3 bg-rose-900/60 rounded-xl text-xs text-rose-100 space-y-1">
              <p className="font-bold">Instructions to unlock exam:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-rose-200">
                <li>Open your browser toolbar or extension settings (<code className="bg-black/40 px-1 py-0.5 rounded font-mono">chrome://extensions</code>).</li>
                <li>Disable all active extensions, AI sidebars, and assistants.</li>
                <li>Click <strong>"Verify & Resume Exam"</strong> below.</li>
              </ol>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const recheck = scanForActiveExtensions();
                  if (recheck.hasExtensions) {
                    alert(`Cannot resume: Extension(s) still detected: ${recheck.detectedExtensions.map(e => e.name).join(', ')}. Please disable them first in chrome://extensions.`);
                  } else {
                    clearExtensionBlock();
                    logCustomEvent("EXTENSION_RESOLVED", "INFO", { status: "cleared" }, true);
                  }
                }}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white shadow-lg transition"
              >
                Verify & Resume Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Examiner Direct Live Warning Modal */}
      {examinerWarning && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-rose-950/95 border-2 border-rose-500 rounded-2xl p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-rose-600 rounded-full animate-bounce">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">OFFICIAL PROCTOR INSTRUCTION</h3>
                <p className="text-xs text-rose-200">Issued by {examinerWarning.sentBy}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-rose-800 text-sm font-medium text-rose-100">
              "{examinerWarning.message}"
            </div>

            <p className="text-xs text-rose-300">
              Please comply with this proctor instruction immediately. All actions continue to be logged in your examination audit record.
            </p>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setExaminerWarning(null)}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white shadow-lg transition"
              >
                I Acknowledge & Return to Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Examiner Remote Freeze Modal Overlay */}
      {isFrozen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-xl bg-slate-900 border-2 border-amber-500 rounded-3xl p-8 text-white shadow-2xl space-y-6 text-center">
            <div className="w-20 h-20 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto text-amber-400 animate-pulse">
              <ShieldAlert className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Examination Session Paused
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">SESSION FROZEN BY PROCTOR</h2>
            </div>

            <div className="p-4 rounded-2xl bg-black/50 border border-slate-700 text-sm font-medium text-amber-100 text-left">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Reason Stated by Proctor:</p>
              <p className="text-sm text-slate-200 leading-relaxed italic">"{frozenReason || "Exam temporarily paused by proctor for integrity review."}"</p>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              Your exam timer and inputs have been halted. Do not close or refresh this tab. Your video and audio feeds remain actively recorded for verification.
            </p>

            <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Awaiting proctor signal to unfreeze and resume...</span>
            </div>
          </div>
        </div>
      )}

      {/* Module 3: Active Floating Webcam Telemetry Monitor */}
      {id && (
        <WebcamMonitor
          attemptId={id}
          enabled={!!attempt && attempt.status === "IN_PROGRESS"}
          onAnomaly={(msg) => {
            setCameraWarning(msg);
            setTimeout(() => setCameraWarning(null), 4500);
          }}
        />
      )}

      {/* Production Audio & Acoustic Proctoring Monitor */}
      {id && (
        <AudioMonitor
          attemptId={id}
          enabled={!!attempt && attempt.status === "IN_PROGRESS"}
          onAudioAnomaly={(msg) => {
            setCameraWarning(msg);
            setTimeout(() => setCameraWarning(null), 4500);
          }}
        />
      )}
    </div>
  );
};
