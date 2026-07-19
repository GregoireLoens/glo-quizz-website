import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { GlowBackdrop, LOBBY_GLOWS } from '../components/GlowBackdrop'
import { NavPill } from '../components/NavPill'
import { PillButton } from '../components/PillButton'
import { PillInput } from '../components/PillInput'
import { api, ApiError } from '../lib/api'
import type { AuthResponse } from '../lib/types'
import { formatUserCodeInput } from '../lib/utils'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((s) => s.setSession)
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const res = await api.post<AuthResponse>('/api/auth/login', { username: username.trim(), code })
      setSession(res.token, res.user)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Pseudo ou code invalide.')
      } else {
        setError('Connexion impossible pour le moment. Réessaie.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop glows={LOBBY_GLOWS} />
      <NavPill variant="auth" />

      <form
        onSubmit={submit}
        className="relative mx-auto mt-20 flex w-full max-w-[440px] flex-col items-center gap-[22px] pb-20"
      >
        <h1 className="text-center font-display text-[40px] font-semibold text-cream">
          Content de te revoir 👋
        </h1>
        <p className="text-center text-[15px] leading-[22px] text-muted-soft">
          Entre ton pseudo et ton code unique pour retrouver ton compte.
        </p>

        <div className="mt-2 flex w-full flex-col gap-[22px]">
          <PillInput
            label="Pseudo"
            placeholder="FalconRouge92"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={error ? '' : null}
            autoFocus
            maxLength={20}
          />
          <PillInput
            label="Code unique"
            placeholder="7F3K-9QRT"
            value={code}
            onChange={(e) => setCode(formatUserCodeInput(e.target.value))}
            error={error}
            code
          />
        </div>

        <PillButton
          type="submit"
          size="lg"
          full
          disabled={loading || username.trim().length < 3 || code.replace('-', '').length < 8}
        >
          {loading ? 'Connexion…' : 'Se connecter'}
          <span className="text-lg">→</span>
        </PillButton>

        <span className="mt-1 text-center text-[12.5px] leading-[18px] text-muted">
          Code oublié ? Il n'y a aucun moyen de le récupérer.
          <br />
          <Link to="/register" className="font-semibold text-coral hover:underline">
            Créer un nouveau compte
          </Link>
        </span>
      </form>
    </div>
  )
}
