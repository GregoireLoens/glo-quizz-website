import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { initials } from '../lib/utils'
import { useAuthStore } from '../stores/authStore'
import { Button } from './Button'
import { Logo } from './Logo'

const LINKS = [
  { to: '/', label: 'Explorer' },
  { to: '/join', label: 'Multijoueur' },
  { to: '/leaderboard', label: 'Classement' },
]

/** Remplace NavPill. Le catalogue étant en lecture seule (alimenté par les scripts d'import),
 * il n'y a ni « Créer » ni « Mes quiz » : les trois sections du site tiennent dans la barre.
 * Sous md, ces liens cèdent la place à BottomNav (voir App.tsx) — seuls logo et profil
 * restent dans la barre haute. */
export function NavBar({ variant = 'app' }: { variant?: 'app' | 'auth' }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="flex h-[76px] items-center gap-3 border-b border-line px-4 sm:gap-7 sm:px-8">
      {/* Sous sm, le lockup pousse « Inscription » hors de l'écran : on tombe sur le
          monogramme seul, ce que le design system prévoit quand la place manque. */}
      {/* La bascule se joue sur les conteneurs, pas sur le Logo : `hidden` et
          `inline-flex` sont deux utilitaires `display`, c'est l'ordre du CSS
          généré qui tranche et les deux logos s'affichaient. */}
      <Link to="/" className="flex-none" aria-label="Midi Quizz — accueil">
        <span className="block sm:hidden">
          <Logo size={26} variant="mono" />
        </span>
        <span className="hidden sm:block">
          <Logo size={26} />
        </span>
      </Link>

      {variant === 'auth' ? (
        <div className="ml-auto flex items-center gap-2">
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `flex h-11 items-center rounded-full px-[18px] text-[15px] font-semibold ${
                isActive ? 'bg-cream text-ink' : 'text-cream-soft hover:text-cream'
              }`
            }
          >
            Connexion
          </NavLink>
          <NavLink
            to="/register"
            className={({ isActive }) =>
              `flex h-11 items-center rounded-full px-[18px] text-[15px] font-semibold ${
                isActive ? 'bg-cream text-ink' : 'text-cream-soft hover:text-cream'
              }`
            }
          >
            Inscription
          </NavLink>
        </div>
      ) : (
        <>
          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `flex h-[38px] items-center rounded-full px-[14px] text-base ${
                    isActive ? 'bg-citron/13 font-semibold text-citron' : 'font-medium text-cream-soft hover:text-cream'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex h-11 cursor-pointer items-center gap-2.5 rounded-full border border-line-strong py-0 pl-1.5 pr-[14px]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-citron font-display text-sm font-semibold text-ink">
                      {initials(user.username)}
                    </span>
                    <span className="hidden text-sm font-semibold text-cream sm:inline">{user.username}</span>
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-[52px] z-20 flex w-48 flex-col gap-1 rounded-xl border border-line bg-card p-2">
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
              </>
            ) : (
              <>
                <Button size="compact" variant="ghost" className="whitespace-nowrap" onClick={() => navigate('/login')}>
                  Connexion
                </Button>
                <Button size="compact" className="whitespace-nowrap" onClick={() => navigate('/register')}>
                  Inscription
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </nav>
  )
}
