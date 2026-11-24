import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { attemptService } from "../../services/attempt.service";
import { useProctorMonitor } from "../../hooks/useProctorMonitor";
import { ExamAttempt, Question } from "../../types";
import { Clock, ShieldCheck, ChevronLeft, ChevronRight, AlertCircle, Maximize2, AlertTriangle } from "lucide-react";

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

  const navigate = useNavigate();
  const timerRef = useRef<any>(null);

  // Module 2: Active Browser Proctor Monitoring
  const { isFullscreen, enterFullscreen, activeWarning, loggedEventsCount } = useProctorMonitor({
    attemptId: id || null,
    enabled: !!attempt && attempt.status === "IN_PROGRESS"
  });

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

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
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
    if (!id || submitting) return;

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
    if (!id || submitting) return;
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

        {/* Live Timer, Fullscreen, & Finish Button */}
        <div className="flex items-center gap-3">
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
      {activeWarning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-xl w-full px-4 animate-bounce">
          <div className="bg-rose-600 text-white p-3.5 rounded-xl shadow-lg border border-rose-700 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-semibold leading-relaxed">{activeWarning}</p>
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
    </div>
  );
};
