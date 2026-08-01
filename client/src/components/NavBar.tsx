import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { initials } from '../lib/utils'
import { useAuthStore } from '../stores/authStore'
import { Button } from './Button'
import { Icon } from './Icon'

const LINKS = [
  { to: '/', label: 'Explorer' },
  { to: '/join', label: 'Multijoueur' },
  { to: '/leaderboard', label: 'Classement' },
  { to: '/quizzes/mine', label: 'Mes quiz' },
]

/** Remplace NavPill. « Créer » et « Mes quiz » entrent dans la barre desktop — deux
 * fonctionnalités complètes n'avaient aucun point d'entrée visible. Le bouton « Créer » n'a pas
 * encore d'action : il n'existe pas de parcours de création de quiz dans l'app (seule l'édition
 * d'un quiz existant l'est), à traiter séparément. Sous md, les liens et « Créer » cèdent la
 * place à BottomNav (voir App.tsx) — seuls logo et profil restent dans la barre haute. */
export function NavBar({ variant = 'app' }: { variant?: 'app' | 'auth' }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="flex h-[76px] items-center gap-3 border-b border-line px-4 sm:gap-7 sm:px-8">
      <Link to="/" className="flex-none font-display text-xl font-semibold tracking-[-0.4px] text-cream">
        Midi<span className="text-citron">Quizz</span>
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
                <div className="hidden md:block">
                  <Button size="secondaire" variant="contour" icon={<Icon name="editer" size={17} />}>
                    Créer
                  </Button>
                </div>
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
