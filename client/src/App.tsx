import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

import { BottomNav, type BottomNavItem } from './components/BottomNav'
import { GamePage } from './pages/GamePage'
import { HomePage } from './pages/HomePage'
import { JoinPage } from './pages/JoinPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterCodePage } from './pages/RegisterCodePage'
import { RegisterPage } from './pages/RegisterPage'
import { useAuthStore } from './stores/authStore'
import { useLeadersStore } from './stores/leadersStore'

function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <Outlet />
}

// Le catalogue est en lecture seule (ni création ni édition de quiz) : la nav tient en
// trois entrées, « Multijoueur » prenant la place centrale surélevée laissée par « Créer »
// puisque c'est l'action principale du site.
const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { label: 'Explorer', icon: 'chercher', to: '/' },
  { label: 'Multijoueur', icon: 'joueurs', to: '/join', raised: true },
  { label: 'Classement', icon: 'trophee', to: '/leaderboard' },
]

function bottomNavSection(pathname: string): string | null {
  if (pathname === '/login' || pathname === '/register' || pathname === '/register/code') return null
  if (pathname === '/') return 'Explorer'
  if (pathname === '/leaderboard') return 'Classement'
  if (pathname === '/join' || pathname.startsWith('/game/')) return 'Multijoueur'
  return null
}

function AppBottomNav() {
  const { pathname } = useLocation()
  const section = bottomNavSection(pathname)
  if (!section) return null
  return <BottomNav items={BOTTOM_NAV_ITEMS} active={section} />
}

export default function App() {
  // top 3 du classement général : les médailles s'affichent sur les avatars de toute l'app
  useEffect(() => {
    useLeadersStore.getState().load()
  }, [])

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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AppBottomNav />
    </main>
  )
}
