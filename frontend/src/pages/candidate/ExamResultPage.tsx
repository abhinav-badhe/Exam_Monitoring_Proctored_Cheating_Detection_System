import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { attemptService } from "../../services/attempt.service";
import { ExamAttempt } from "../../types";
import { CheckCircle2, XCircle, ArrowLeft, Trophy, Clock, HelpCircle, AlertCircle } from "lucide-react";

export const ExamResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResult = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await attemptService.getCandidateResult(id);
        setAttempt(data);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load examination results");
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [id]);

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">Retrieving evaluated results...</div>;
  }

  if (!attempt) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-rose-500">Result not found</div>;
  }

  const score = attempt.totalScore ?? 0;
  const total = attempt.exam.totalMarks || 1;
  const percentage = Math.round((score / total) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/candidate"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Dashboard
      </Link>

      {/* Score Summary Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 mb-8 text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-8 h-8" />
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          Examination Submitted & Evaluated
        </span>

        <h1 className="text-2xl font-bold text-slate-900 mt-2">{attempt.exam.title}</h1>

        <div className="mt-6 flex items-center justify-center gap-8">
          <div>
            <p className="text-xs uppercase font-medium text-slate-400">Total Score</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-0.5">
              {score} <span className="text-sm font-normal text-slate-400">/ {total}</span>
            </p>
          </div>
          <div className="w-px h-10 bg-slate-200"></div>
          <div>
            <p className="text-xs uppercase font-medium text-slate-400">Percentage</p>
            <p className="text-3xl font-extrabold text-blue-600 mt-0.5">{percentage}%</p>
          </div>
          <div className="w-px h-10 bg-slate-200"></div>
          <div>
            <p className="text-xs uppercase font-medium text-slate-400">Status</p>
            <p className="text-base font-bold text-slate-800 mt-1.5">{attempt.status}</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-6">
          Submitted on: {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "Just now"}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Question by Question Review */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          Review Questions & Answer Key
        </h2>

        {attempt.answers.map((ans, idx) => {
          const q = ans.question;
          if (!q) return null;

          const isCorrect = (ans.marksAwarded ?? 0) > 0;

          return (
            <div key={ans.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase">Question {idx + 1}</span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    isCorrect
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> +{ans.marksAwarded} Marks
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> 0 / {q.marks} Marks
                    </>
                  )}
                </span>
              </div>

              <h3 className="mt-3 text-base font-semibold text-slate-900 leading-relaxed">
                {q.questionText}
              </h3>

              {/* Options */}
              <div className="mt-4 space-y-2">
                {q.options?.map((opt) => {
                  const wasSelected = ans.selectedOptionId === opt.id;
                  const isOptionCorrect = opt.isCorrect;

                  let style = "bg-slate-50 border-slate-200 text-slate-600";
                  if (isOptionCorrect) {
                    style = "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold";
                  } else if (wasSelected && !isOptionCorrect) {
                    style = "bg-rose-50 border-rose-300 text-rose-900 font-semibold";
                  }

                  return (
                    <div
                      key={opt.id}
                      className={`px-4 py-2.5 rounded-lg border text-sm flex items-center justify-between ${style}`}
                    >
                      <div className="flex items-center gap-2">
                        {wasSelected && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-white/70 border text-slate-700">
                            Your Choice
                          </span>
                        )}
                        <span>{opt.optionText}</span>
                      </div>

                      {isOptionCorrect && (
                        <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Correct Answer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
