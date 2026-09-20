import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles.css';
import { applyTextureVariables } from './assets/applyTextures';

applyTextureVariables();
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAuth, RequireRole } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { ErrorBoundary } from './components/ErrorBanner';

import { RoleSelect } from './pages/RoleSelect';
import { Register } from './pages/Register';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { Join } from './pages/Join';

import { TeacherDashboard } from './pages/teacher/Dashboard';
import { TeacherQuizzes } from './pages/teacher/Quizzes';
import { QuizEditor } from './pages/teacher/QuizEditor';
import { TeacherSessions } from './pages/teacher/Games';
import { LiveQuiz } from './pages/teacher/LiveQuiz';
import { TeacherResults } from './pages/teacher/Results';
import { GameResultsTeacher } from './pages/teacher/GameResultsTeacher';
import { TeacherProfile } from './pages/teacher/TeacherProfile';

import { StudentHome } from './pages/student/Home';
import { StudentProgress } from './pages/student/Progress';
import { StudentProfile } from './pages/student/StudentProfile';
import { Play } from './pages/student/Play';

import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

function Fallback() {
  return <div className="page-center"><Spinner /></div>;
}

/** Sends a signed-in user to their role home (or the register flow when logged out). */
function HomeRedirect() {
  const { user, profile, loading } = useAuth();
  if (loading) return <Fallback />;
  if (user && profile) {
    return <Navigate to={profile.role === 'teacher' ? '/teacher/dashboard' : '/student'} replace />;
  }
  return <RoleSelect />;
}

/** Keeps the old /settings URL working, inside the right shell. */
function SettingsRedirect() {
  const { profile } = useAuth();
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={profile.role === 'teacher' ? '/teacher/settings' : '/student/settings'} replace />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
          {/* Public — signed-in users land on their role home, others register */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/register" element={<RoleSelect />} />
          <Route path="/register/:role" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/join" element={<Join />} />

          {/* Authenticated + role-verified (role read from Firestore) */}
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole role="teacher" />}>
              <Route path="/teacher" element={<Layout />}>
                <Route index element={<Navigate to="/teacher/dashboard" replace />} />
                <Route path="dashboard" element={<TeacherDashboard />} />
                <Route path="quizzes" element={<TeacherQuizzes />} />
                <Route path="quizzes/new" element={<QuizEditor />} />
                <Route path="quizzes/:quizId" element={<QuizEditor />} />
                <Route path="sessions" element={<TeacherSessions />} />
                <Route path="sessions/:sessionId" element={<LiveQuiz />} />
                <Route path="results" element={<TeacherResults />} />
                <Route path="results/:sessionId" element={<GameResultsTeacher />} />
                <Route path="profile" element={<TeacherProfile />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>

            <Route element={<RequireRole role="student" />}>
              <Route path="/student" element={<Layout />}>
                <Route index element={<StudentHome />} />
                <Route path="progress" element={<StudentProgress />} />
                <Route path="profile" element={<StudentProfile />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>

            {/* Role-neutral aliases: send users to their role-scoped home/settings */}
            <Route path="/settings" element={<SettingsRedirect />} />
          </Route>

          {/* Live quiz play (outside shell, own full-screen layout) */}
          <Route path="/play/:sessionId" element={<Play />} />

          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
