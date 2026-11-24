import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { examService } from "../../services/exam.service";
import { Exam } from "../../types";
import { ShieldAlert, BookOpen, Users, CheckCircle2, Layers } from "lucide-react";

export const AdminDashboard: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await examService.getExams();
        setExams(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 pb-6 border-b border-slate-200">
        <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administrator Console</h1>
          <p className="text-sm text-slate-500">System-wide monitoring, user governance, and assessment auditing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">System Exams</p>
            <p className="text-2xl font-bold text-slate-900">{exams.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Total Attempts</p>
            <p className="text-2xl font-bold text-slate-900">
              {exams.reduce((sum, e) => sum + (e._count?.attempts || 0), 0)}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">System Health</p>
            <p className="text-2xl font-bold text-emerald-600">Active</p>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">All System Examinations</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading system data...</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {exams.map((exam) => (
              <div key={exam.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-slate-900">{exam.title}</p>
                  <p className="text-xs text-slate-400">Created by: {exam.creator?.fullName} • {exam.status}</p>
                </div>
                <Link
                  to={`/examiner/exams/${exam.id}/results`}
                  className="px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-md transition"
                >
                  Audit Results
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
