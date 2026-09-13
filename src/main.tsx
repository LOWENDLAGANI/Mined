import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles.css';
import { applyTextureVariables } from './assets/applyTextures';

applyTextureVariables();
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth, RequireRole } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';

import { RoleSelect } from './pages/RoleSelect';
import { Register } from './pages/Register';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { Join } from './pages/Join';

import { TeacherDashboard } from './pages/teacher/Dashboard';
import { TeacherQuizzes } from './pages/teacher/Quizzes';
import { QuizEditor } from './pages/teacher/QuizEditor';
import { TeacherGames } from './pages/teacher/Games';
import { GameLobby } from './pages/teacher/GameLobby';
import { TeacherResults } from './pages/teacher/Results';
import { GameResultsTeacher } from './pages/teacher/GameResultsTeacher';
import { TeacherProfile } from './pages/teacher/TeacherProfile';

import { StudentHome } from './pages/student/Home';
import { StudentProgress } from './pages/student/Progress';
import { StudentAchievements } from './pages/student/Achievements';
import { StudentLeaderboard } from './pages/student/Leaderboard';
import { StudentProfile } from './pages/student/StudentProfile';
import { StudentGame } from './pages/student/StudentGame';

import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

function Fallback() {
  return <div className="page-center"><Spinner /></div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public — / goes straight to registration (role select) */}
          <Route path="/" element={<RoleSelect />} />
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
                <Route path="games" element={<TeacherGames />} />
                <Route path="games/:sessionId" element={<GameLobby />} />
                <Route path="results" element={<TeacherResults />} />
                <Route path="results/:sessionId" element={<GameResultsTeacher />} />
                <Route path="profile" element={<TeacherProfile />} />
              </Route>
            </Route>

            <Route element={<RequireRole role="student" />}>
              <Route path="/student" element={<Layout />}>
                <Route index element={<StudentHome />} />
                <Route path="progress" element={<StudentProgress />} />
                <Route path="achievements" element={<StudentAchievements />} />
                <Route path="leaderboard" element={<StudentLeaderboard />} />
                <Route path="profile" element={<StudentProfile />} />
              </Route>
            </Route>

            {/* Role-neutral authenticated */}
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Live gameplay (outside shell, own full-screen layout) */}
          <Route path="/game/:sessionId" element={<StudentGame />} />

          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
