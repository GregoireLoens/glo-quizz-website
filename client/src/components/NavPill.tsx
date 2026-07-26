import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'

import { useAuthStore } from '../stores/authStore'
import { initials } from '../lib/utils'

function AppLink({ to, label }: { to: string; label: string }) {
  const { pathname } = useLocation()
  const active = pathname === to
  return (
    <Link
      to={to}
      className={
        active
          ? 'flex h-9 items-center rounded-full bg-citron/14 px-4 text-sm font-semibold text-citron'
          : 'text-sm font-medium text-cream-soft transition hover:text-cream'
      }
    >
      {label}
    </Link>
  )
}

export function NavPill({ variant = 'app' }: { variant?: 'app' | 'auth' }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="relative z-10 mx-auto mt-6 flex h-16 w-full max-w-[1080px] items-center gap-3 rounded-[32px] border border-white/12 bg-white/6 pl-5 pr-2.5 backdrop-blur-md md:gap-7 md:pl-[26px]">
      <Link to="/" className="whitespace-nowrap font-display text-[21px] font-semibold text-cream">
        midi quizz
      </Link>
      <div className="flex-1" />

      {variant === 'auth' ? (
        <>
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `flex h-10 items-center rounded-full px-[18px] text-[13.5px] font-semibold ${
                isActive ? 'bg-cream text-ink' : 'text-cream-soft hover:text-cream'
              }`
            }
          >
            Connexion
          </NavLink>
          <NavLink
            to="/register"
            className={({ isActive }) =>
              `flex h-10 items-center rounded-full px-[18px] text-[13.5px] font-semibold ${
                isActive ? 'bg-cream text-ink' : 'text-cream-soft hover:text-cream'
              }`
            }
          >
            Inscription
          </NavLink>
        </>
      ) : (
        <>
          <div className="hidden items-center gap-7 md:flex">
            <AppLink to="/" label="Explorer" />
            <AppLink to="/join" label="Multijoueur" />
            <AppLink to="/leaderboard" label="Classement" />
          </div>
          {user ? (
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-cream py-0 pl-2.5 pr-5 text-ink"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-cream">
                  {initials(user.username)}
                </div>
                <span className="max-w-[88px] truncate text-[13.5px] font-semibold sm:max-w-none">
                  {user.username}
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-[52px] z-20 flex w-48 flex-col gap-1 rounded-3xl border border-cream/10 bg-card p-2">
                  <div className="flex flex-col gap-1 md:hidden">
                    {[
                      { to: '/', label: 'Explorer' },
                      { to: '/join', label: 'Multijoueur' },
                      { to: '/leaderboard', label: 'Classement' },
                    ].map((l) => (
                      <Link
                        key={l.to}
                        to={l.to}
                        onClick={() => setMenuOpen(false)}
                        className="rounded-full px-4 py-2.5 text-sm font-medium text-cream hover:bg-cream/5"
                      >
                        {l.label}
                      </Link>
                    ))}
                    <div className="mx-3 my-1 h-px bg-cream/10" />
                  </div>
                  <Link
                    to="/quizzes/mine"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-full px-4 py-2.5 text-sm font-medium text-cream hover:bg-cream/5"
                  >
                    Mes quiz
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      logout()
                      navigate('/')
                    }}
                    className="cursor-pointer rounded-full px-4 py-2.5 text-left text-sm font-medium text-coral hover:bg-coral/10"
                  >
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="ml-1 flex items-center gap-2">
              <Link
                to="/login"
                className="flex h-10 items-center rounded-full px-[18px] text-[13.5px] font-semibold text-cream-soft hover:text-cream"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="flex h-10 items-center rounded-full bg-cream px-[18px] text-[13.5px] font-semibold text-ink"
              >
                Inscription
              </Link>
            </div>
          )}
        </>
      )}
    </nav>
  )
}
