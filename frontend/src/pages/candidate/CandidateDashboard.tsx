import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { examService } from "../../services/exam.service";
import { Exam } from "../../types";
import { BookOpen, Clock, Award, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";

export const CandidateDashboard: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
        const data = await examService.getExams();
        setExams(data);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load available examinations");
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-8 text-white shadow-sm mb-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-800/80 text-blue-200 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            ProctorAI Secure Assessment Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Available Examinations</h1>
          <p className="mt-2 text-sm text-blue-100">
            Select an assessment below to review the proctoring guidelines and begin your timed test.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Exam Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading available examinations...</div>
      ) : exams.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="font-medium text-slate-700">No active examinations</p>
          <p className="text-xs text-slate-400 mt-1">There are currently no scheduled exams published by your examiner.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                    {exam._count?.questions || 0} Questions
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    {exam.durationMinutes} mins
                  </span>
                </div>

                <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">
                  {exam.title}
                </h2>
                <p className="mt-2 text-xs text-slate-500 line-clamp-3 leading-relaxed">
                  {exam.description || "No specific instructions provided."}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  {exam.totalMarks} Total Marks
                </span>

                <Link
                  to={`/candidate/exam/${exam.id}/instructions`}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                >
                  Start Exam
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
