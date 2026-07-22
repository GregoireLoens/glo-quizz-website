import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

import { GamePage } from './pages/GamePage'
import { HomePage } from './pages/HomePage'
import { JoinPage } from './pages/JoinPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { LoginPage } from './pages/LoginPage'
import { MyQuizzesPage } from './pages/MyQuizzesPage'
import { QuizEditorPage } from './pages/QuizEditorPage'
import { RegisterCodePage } from './pages/RegisterCodePage'
import { RegisterPage } from './pages/RegisterPage'
import { useAuthStore } from './stores/authStore'

function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <Outlet />
}

export default function App() {
  return (
    <main>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/code" element={<RegisterCodePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/join" element={<JoinPage />} />
          <Route path="/game/:code" element={<GamePage />} />
          <Route path="/quizzes/mine" element={<MyQuizzesPage />} />
          <Route path="/quiz/new" element={<QuizEditorPage />} />
          <Route path="/quiz/:id/edit" element={<QuizEditorPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  )
}
