import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { attemptService } from "../../services/attempt.service";
import { examService } from "../../services/exam.service";
import { ExamAttempt, Exam } from "../../types";
import { ArrowLeft, Users, Trophy, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export const ExamResultsPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [results, setResults] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          Automated MCQ grading results, candidate session status, and submission logs
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
                  <th className="px-6 py-3.5">Started At</th>
                  <th className="px-6 py-3.5">Submitted At</th>
                  <th className="px-6 py-3.5 text-right">Score Awarded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((att) => (
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
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(att.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {att.submittedAt
                        ? new Date(att.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "In Progress"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-base text-slate-900">
                        {att.totalScore ?? "Pending"}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">/ {exam?.totalMarks}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
