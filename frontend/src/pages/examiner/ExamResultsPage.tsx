import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { attemptService } from "../../services/attempt.service";
import { examService } from "../../services/exam.service";
import { proctorService, ProctorEventsResponse } from "../../services/proctor.service";
import { ExamAttempt, Exam } from "../../types";
import { ArrowLeft, Users, Trophy, ShieldAlert, AlertCircle, X, Activity, BrainCircuit, AlertTriangle, ShieldCheck } from "lucide-react";

export const ExamResultsPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [results, setResults] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Proctoring audit modal
  const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null);
  const [proctorLogs, setProctorLogs] = useState<ProctorEventsResponse | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [evaluatingAnomaly, setEvaluatingAnomaly] = useState(false);

  const fetchData = async () => {
    if (!examId) return;
    try {
      setLoading(true);
      const [examData, attemptsData] = await Promise.all([
        examService.getExamById(examId),
        attemptService.getExamResults(examId)
      ]);
      setExam(examData);
      setResults(attemptsData);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load examination results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [examId]);

  const handleOpenProctorModal = async (attempt: ExamAttempt) => {
    setSelectedAttempt(attempt);
    setLoadingLogs(true);
    try {
      const logs = await proctorService.getAttemptEvents(attempt.id);
      setProctorLogs(logs);
    } catch (err: any) {
      console.error("Failed to load proctor events:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRunAnomalyEvaluation = async (attemptId: string) => {
    setEvaluatingAnomaly(true);
    try {
      await proctorService.evaluateAttemptAnomaly(attemptId);
      await fetchData();
      // Refresh current modal attempt
      const updatedAttempts = await attemptService.getExamResults(examId!);
      const current = updatedAttempts.find((a) => a.id === attemptId);
      if (current) setSelectedAttempt(current);
    } catch (err: any) {
      console.error("Failed to run anomaly evaluation:", err);
    } finally {
      setEvaluatingAnomaly(false);
    }
  };

  const getRiskBadge = (scoreObj?: any) => {
    if (!scoreObj) {
      return (
        <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-500 rounded-lg">
          Unscored
        </span>
      );
    }

    const level = scoreObj.riskLevel;
    const score = Math.round(scoreObj.score);

    switch (level) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            CRITICAL ({score})
          </span>
        );
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            HIGH ({score})
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Activity className="w-3.5 h-3.5" />
            MEDIUM ({score})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            LOW ({score})
          </span>
        );
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <span className="px-2 py-0.5 text-xs font-bold bg-rose-600 text-white rounded-md">CRITICAL</span>;
      case "HIGH":
        return <span className="px-2 py-0.5 text-xs font-bold bg-rose-100 text-rose-800 rounded-md">HIGH</span>;
      case "MEDIUM":
        return <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-md">MEDIUM</span>;
      case "LOW":
        return <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-md">LOW</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-md">INFO</span>;
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-12 text-center text-slate-500">Loading candidate submissions...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/examiner"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 mb-8">
        <h1 className="text-xl font-bold text-slate-900">
          Submissions & Proctoring Audit: {exam?.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Automated evaluation scores, multi-signal behavioural risk indicators, and proctoring telemetry audit
        </p>

        <div className="mt-4 flex items-center gap-6 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-400" />
            Total Submissions: <strong className="text-slate-900">{results.length}</strong>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-slate-400" />
            Total Examination Marks: <strong className="text-slate-900">{exam?.totalMarks || 0}</strong>
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {results.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="font-medium">No candidate attempts recorded yet</p>
            <p className="text-xs text-slate-400 mt-1">Once candidates start and submit this exam, their scores will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Candidate Name</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Exam Score</th>
                  <th className="px-6 py-3.5">Anomaly Risk Score</th>
                  <th className="px-6 py-3.5 text-right">Audit Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((att: any) => {
                  const latestScore = att.scores && att.scores.length > 0 ? att.scores[0] : null;
                  return (
                    <tr key={att.id} className="hover:bg-slate-50/75 transition">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {att.candidate?.fullName || "Anonymous"}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{att.candidate?.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            att.status === "SUBMITTED"
                              ? "bg-emerald-100 text-emerald-800"
                              : att.status === "AUTO_SUBMITTED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {att.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-base text-slate-900">
                          {att.totalScore ?? "Pending"}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">/ {exam?.totalMarks}</span>
                      </td>
                      <td className="px-6 py-4">
                        {getRiskBadge(latestScore)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenProctorModal(att)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                        >
                          Audit Session
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proctoring Audit Logs & Explainable Anomaly Modal */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Candidate Integrity & Telemetry Audit</h3>
                  <p className="text-xs text-slate-500">{selectedAttempt.candidate?.fullName} ({selectedAttempt.candidate?.email})</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedAttempt(null);
                  setProctorLogs(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Anomaly Assessment Score Card */}
              {selectedAttempt.scores && selectedAttempt.scores.length > 0 ? (
                (() => {
                  const scoreObj = selectedAttempt.scores[0];
                  const explanation = scoreObj.explanation || {};
                  return (
                    <div className="p-5 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <BrainCircuit className="w-5 h-5 text-blue-600" />
                          <h4 className="font-bold text-slate-900 text-sm">Behavioural Anomaly Risk Assessment</h4>
                        </div>
                        {getRiskBadge(scoreObj)}
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                          <p className="text-2xs uppercase text-slate-400 font-semibold">Total Risk Score</p>
                          <p className="text-xl font-extrabold text-slate-900 mt-0.5">{Math.round(scoreObj.score)} / 100</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                          <p className="text-2xs uppercase text-slate-400 font-semibold">Rule Engine Score</p>
                          <p className="text-xl font-bold text-slate-700 mt-0.5">{explanation.ruleScore ?? "--"}</p>
                        </div>
                        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
                          <p className="text-2xs uppercase text-slate-400 font-semibold">Isolation Forest ML</p>
                          <p className="text-xl font-bold text-slate-700 mt-0.5">{explanation.mlIsolationForestScore ?? "--"}</p>
                        </div>
                      </div>

                      {/* Rule Violations Breakdown */}
                      {explanation.ruleViolations && explanation.ruleViolations.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Triggered Correlation Flags:</p>
                          {explanation.ruleViolations.map((v: any, idx: number) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold font-mono text-2xs mr-1">[{v.rule}]</span>
                                {v.explanation}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="text-2xs text-slate-400 mt-3 italic">{explanation.disclaimer}</p>
                    </div>
                  );
                })()
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-600">Session anomaly score has not been calculated yet.</span>
                  <button
                    onClick={() => handleRunAnomalyEvaluation(selectedAttempt.id)}
                    disabled={evaluatingAnomaly}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50"
                  >
                    {evaluatingAnomaly ? "Calculating..." : "Compute Anomaly Score"}
                  </button>
                </div>
              )}

              {/* Event Stream Section */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-3">Chronological Proctoring Telemetry</h4>
                {loadingLogs ? (
                  <div className="p-8 text-center text-slate-500 text-xs">Loading proctoring event stream...</div>
                ) : !proctorLogs || proctorLogs.events.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    No proctoring anomalies recorded for this session.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {proctorLogs.events.map((evt: any, idx: number) => (
                      <div
                        key={evt.id || idx}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(evt.severity)}
                            <span className="font-bold text-slate-900 font-mono text-xs">{evt.eventType}</span>
                          </div>
                          {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                            <pre className="mt-1 text-2xs font-mono bg-white p-1.5 rounded border border-slate-200 text-slate-600 overflow-x-auto max-w-lg">
                              {JSON.stringify(evt.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                        <span className="text-slate-400 whitespace-nowrap text-2xs">
                          {new Date(evt.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => {
                  setSelectedAttempt(null);
                  setProctorLogs(null);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
