import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { attemptService } from "../../services/attempt.service";
import { examService } from "../../services/exam.service";
import { proctorService, ProctorEventsResponse } from "../../services/proctor.service";
import { ExamAttempt, Exam } from "../../types";
import { ArrowLeft, Users, Trophy, ShieldAlert, AlertCircle, X, Activity } from "lucide-react";

export const ExamResultsPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [results, setResults] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Proctoring audit modal
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [proctorLogs, setProctorLogs] = useState<ProctorEventsResponse | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
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

    fetchData();
  }, [examId]);

  const handleOpenProctorModal = async (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    setLoadingLogs(true);
    try {
      const logs = await proctorService.getAttemptEvents(attemptId);
      setProctorLogs(logs);
    } catch (err: any) {
      console.error("Failed to load proctor events:", err);
    } finally {
      setLoadingLogs(false);
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
          Submissions & Grading: {exam?.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Automated MCQ grading results, candidate session status, and proctoring telemetry logs
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
                  <th className="px-6 py-3.5">Score Awarded</th>
                  <th className="px-6 py-3.5">Proctoring Telemetry</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((att: any) => {
                  const eventCount = att._count?.events || 0;
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
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                            eventCount > 0
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Activity className="w-3.5 h-3.5" />
                          {eventCount} incident(s) logged
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenProctorModal(att.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                        >
                          Audit Logs
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

      {/* Proctoring Audit Logs Modal */}
      {selectedAttemptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Candidate Proctoring Telemetry Audit</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedAttemptId(null);
                  setProctorLogs(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingLogs ? (
                <div className="p-12 text-center text-slate-500">Loading proctoring event stream...</div>
              ) : !proctorLogs || proctorLogs.events.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <p className="font-medium">No proctoring anomalies or events recorded for this session.</p>
                  <p className="text-xs text-slate-400 mt-1">The candidate maintained clean focus throughout the attempt.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Severity Breakdown Badges */}
                  <div className="flex items-center gap-2 flex-wrap pb-4 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase text-slate-400 mr-2">Severity Breakdown:</span>
                    {Object.entries(proctorLogs.severityBreakdown).map(([sev, cnt]) => (
                      <span key={sev} className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 border text-slate-700">
                        {sev}: <strong>{cnt}</strong>
                      </span>
                    ))}
                  </div>

                  {/* Chronological Event Timeline */}
                  <div className="space-y-3">
                    {proctorLogs.events.map((evt, idx) => (
                      <div
                        key={evt.id || idx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            {getSeverityBadge(evt.severity)}
                            <span className="font-bold text-slate-900 text-sm font-mono">{evt.eventType}</span>
                          </div>
                          {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                            <pre className="mt-2 text-2xs font-mono bg-white p-2 rounded border border-slate-200 text-slate-600 overflow-x-auto max-w-md">
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
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => {
                  setSelectedAttemptId(null);
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
