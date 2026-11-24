import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { examService } from "../../services/exam.service";
import { Exam } from "../../types";
import { ArrowLeft, Plus, Trash2, CheckCircle2, Clock, HelpCircle, AlertCircle } from "lucide-react";

export const ExamDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New question form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [marks, setMarks] = useState(10);
  const [options, setOptions] = useState([
    { optionText: "", isCorrect: true },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false }
  ]);
  const [savingQuestion, setSavingQuestion] = useState(false);

  const fetchExam = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await examService.getExamById(id);
      setExam(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load exam details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [id]);

  const handleOptionChange = (index: number, text: string) => {
    const updated = [...options];
    updated[index].optionText = text;
    setOptions(updated);
  };

  const handleCorrectOptionSelect = (index: number) => {
    const updated = options.map((opt, i) => ({
      ...opt,
      isCorrect: i === index
    }));
    setOptions(updated);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSavingQuestion(true);

    try {
      await examService.addQuestion(id, {
        questionText,
        questionType: "MCQ",
        marks: Number(marks),
        options: options.filter((o) => o.optionText.trim() !== "")
      });

      // Reset form
      setQuestionText("");
      setMarks(10);
      setOptions([
        { optionText: "", isCorrect: true },
        { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false },
        { optionText: "", isCorrect: false }
      ]);
      setShowAddForm(false);
      await fetchExam();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to add question");
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to remove this question?")) return;
    try {
      await examService.deleteQuestion(questionId);
      await fetchExam();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete question");
    }
  };

  const handleTogglePublish = async () => {
    if (!exam) return;
    const newStatus = exam.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await examService.updateExam(exam.id, { status: newStatus });
      await fetchExam();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update exam status");
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-12 text-center text-slate-500">Loading exam details...</div>;
  }

  if (!exam) {
    return <div className="max-w-5xl mx-auto px-4 py-12 text-center text-rose-500">Exam not found</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/examiner"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{exam.title}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  exam.status === "PUBLISHED"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {exam.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{exam.description || "No description provided."}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {exam.durationMinutes} Minutes
              </span>
              <span>•</span>
              <span>Total Marks: <strong className="text-slate-800">{exam.totalMarks}</strong></span>
              <span>•</span>
              <span>Questions: <strong className="text-slate-800">{exam.questions?.length || 0}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/examiner/exams/${exam.id}/live`}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition flex items-center gap-1.5 shadow-xs"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              Live Proctor Monitor
            </Link>
            <button
              onClick={handleTogglePublish}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                exam.status === "PUBLISHED"
                  ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {exam.status === "PUBLISHED" ? "Unpublish to Draft" : "Publish Examination"}
            </button>
            <Link
              to={`/examiner/exams/${exam.id}/results`}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition"
            >
              View Results
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Questions Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Questions & Rubric ({exam.questions?.length || 0})</h2>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          )}
        </div>

        {/* Add Question Card */}
        {showAddForm && (
          <form onSubmit={handleAddQuestion} className="bg-blue-50/50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              Add Multiple Choice Question (MCQ)
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 tracking-wider mb-1">
                  Question Text *
                </label>
                <textarea
                  required
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="State the problem clearly..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 tracking-wider mb-1">
                  Marks Awarded *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value))}
                  className="w-32 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 tracking-wider mb-2">
                  Options (Radio button marks the correct answer) *
                </label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctOption"
                        checked={opt.isCorrect}
                        onChange={() => handleCorrectOptionSelect(i)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        required={i < 2}
                        value={opt.optionText}
                        onChange={(e) => handleOptionChange(i, e.target.value)}
                        placeholder={`Option ${i + 1}${opt.isCorrect ? " (Correct Answer)" : ""}`}
                        className={`flex-1 px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                          opt.isCorrect ? "border-emerald-500 ring-1 ring-emerald-500" : "border-slate-300"
                        }`}
                      />
                      {opt.isCorrect && (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuestion}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {savingQuestion ? "Saving..." : "Save Question"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Question Cards List */}
        {exam.questions && exam.questions.length > 0 ? (
          <div className="space-y-4">
            {exam.questions.map((q, idx) => (
              <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-md">
                      Q{idx + 1} • {q.marks} Marks
                    </span>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">{q.questionText}</h3>
                  </div>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Options List */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      className={`px-3 py-2 text-sm rounded-lg border flex items-center justify-between ${
                        opt.isCorrect
                          ? "bg-emerald-50/50 border-emerald-300 text-emerald-900 font-medium"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      <span>{opt.optionText}</span>
                      {opt.isCorrect && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
            <p className="font-medium">No questions added yet.</p>
            <p className="text-xs text-slate-400 mt-1">Click "Add Question" above to start building the exam.</p>
          </div>
        )}
      </div>
    </div>
  );
};
