import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/layout/Navbar";
import { ProtectedRoute } from "./components/common/ProtectedRoute";

// Auth Pages
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";

// Examiner Pages
import { ExaminerDashboard } from "./pages/examiner/ExaminerDashboard";
import { CreateExamPage } from "./pages/examiner/CreateExamPage";
import { ExamDetailsPage } from "./pages/examiner/ExamDetailsPage";
import { ExamResultsPage } from "./pages/examiner/ExamResultsPage";
import { LiveProctorDashboard } from "./pages/examiner/LiveProctorDashboard";

// Candidate Pages
import { CandidateDashboard } from "./pages/candidate/CandidateDashboard";
import { ExamInstructionsPage } from "./pages/candidate/ExamInstructionsPage";
import { ExamInterfacePage } from "./pages/candidate/ExamInterfacePage";
import { ExamResultPage } from "./pages/candidate/ExamResultPage";

// Admin Pages
import { AdminDashboard } from "./pages/admin/AdminDashboard";

const RootRedirect: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "EXAMINER") return <Navigate to="/examiner" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  return <Navigate to="/candidate" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-50">
          <Routes>
            {/* The active exam interface has its own specialized fullscreen header */}
            <Route path="/candidate/exam/:id" element={
              <ProtectedRoute allowedRoles={["CANDIDATE"]}>
                <ExamInterfacePage />
              </ProtectedRoute>
            } />

            {/* Standard Pages wrapped with Navbar */}
            <Route
              path="*"
              element={
                <>
                  <Navbar />
                  <main className="flex-1">
                    <Routes>
                      {/* Public Routes */}
                      <Route path="/" element={<RootRedirect />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />

                      {/* Candidate Protected Routes */}
                      <Route element={<ProtectedRoute allowedRoles={["CANDIDATE"]} />}>
                        <Route path="/candidate" element={<CandidateDashboard />} />
                        <Route path="/candidate/exam/:id/instructions" element={<ExamInstructionsPage />} />
                        <Route path="/candidate/results/:id" element={<ExamResultPage />} />
                      </Route>

                      {/* Examiner Protected Routes */}
                      <Route element={<ProtectedRoute allowedRoles={["EXAMINER", "ADMIN"]} />}>
                        <Route path="/examiner" element={<ExaminerDashboard />} />
                        <Route path="/examiner/exams/create" element={<CreateExamPage />} />
                        <Route path="/examiner/exams/:id" element={<ExamDetailsPage />} />
                        <Route path="/examiner/exams/:id/live" element={<LiveProctorDashboard />} />
                        <Route path="/examiner/exams/:examId/results" element={<ExamResultsPage />} />
                      </Route>

                      {/* Admin Protected Routes */}
                      <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
                        <Route path="/admin" element={<AdminDashboard />} />
                      </Route>

                      {/* Fallback */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
