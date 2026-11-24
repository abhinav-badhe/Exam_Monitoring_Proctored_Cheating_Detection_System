import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { examService } from "../../services/exam.service";
import { Exam } from "../../types";
import { Plus, BookOpen, Clock, Users, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

export const ExaminerDashboard: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const data = await examService.getExams();
      setExams(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load exams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Published</span>;
      case "DRAFT":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Draft</span>;
      case "COMPLETED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Completed</span>;
      case "ARCHIVED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">Archived</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Examiner Control Center</h1>
          <p className="mt-1 text-sm text-slate-500">Create assessments, configure question banks, and review candidate integrity.</p>
        </div>
        <Link
          to="/examiner/exams/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          Create New Exam
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Total Exams</p>
            <p className="text-2xl font-bold text-slate-900">{exams.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Published</p>
            <p className="text-2xl font-bold text-slate-900">
              {exams.filter((e) => e.status === "PUBLISHED").length}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Candidate Submissions</p>
            <p className="text-2xl font-bold text-slate-900">
              {exams.reduce((acc, curr) => acc + (curr._count?.attempts || 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Exams List Table */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-base font-semibold text-slate-900">Managed Examinations</h2>
        </div>

        {error && (
          <div className="m-6 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading assessments...</div>
        ) : exams.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="font-medium text-slate-700">No exams created yet</p>
            <p className="text-xs text-slate-400 mt-1">Get started by creating your first online assessment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Title & Description</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Duration</th>
                  <th className="px-6 py-3.5">Questions</th>
                  <th className="px-6 py-3.5">Attempts</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/75 transition">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{exam.title}</p>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{exam.description || "No description provided."}</p>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(exam.status)}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-xs text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {exam.durationMinutes} mins
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-800">{exam._count?.questions || 0}</span> questions
                      <span className="text-xs text-slate-400 ml-1.5">({exam.totalMarks} marks)</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-800">{exam._count?.attempts || 0}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/examiner/exams/${exam.id}`}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition"
                        >
                          Manage Questions
                        </Link>
                        <Link
                          to={`/examiner/exams/${exam.id}/results`}
                          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition flex items-center gap-1"
                        >
                          Results
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
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
