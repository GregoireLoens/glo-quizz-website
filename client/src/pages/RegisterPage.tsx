import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { GlowBackdrop, AUTH_GLOWS } from '../components/GlowBackdrop'
import { NavPill } from '../components/NavPill'
import { PillButton } from '../components/PillButton'
import { PillInput } from '../components/PillInput'
import { api, ApiError } from '../lib/api'
import type { AuthResponse } from '../lib/types'
import { useAuthStore } from '../stores/authStore'

export function RegisterPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const res = await api.post<AuthResponse>('/api/auth/register', { username: username.trim() })
      setSession(res.token, res.user)
      navigate('/register/code', { state: { code: res.code, username: res.user.username } })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Ce pseudo est déjà pris — essaie une variante.')
      } else if (err instanceof ApiError && err.status === 422) {
        setError('3 à 20 caractères : lettres, chiffres, tirets ou underscores.')
      } else {
        setError('Impossible de créer le compte pour le moment. Réessaie.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop glows={AUTH_GLOWS} />
      <NavPill variant="auth" />

      <form
        onSubmit={submit}
        className="relative mx-auto mt-[72px] flex w-full max-w-[480px] flex-col items-center gap-[22px] pb-20"
      >
        <div className="flex h-[30px] items-center gap-2 rounded-full bg-citron/14 px-3.5">
          <span className="h-1.5 w-1.5 rounded-full bg-citron" />
          <span className="text-xs font-semibold uppercase tracking-wider text-citron">
            Sans e-mail, sans mot de passe
          </span>
        </div>

        <h1 className="text-center font-display text-[44px] font-semibold leading-[1.1] text-cream">
          Choisis ton
          <br />
          pseudo de jeu
        </h1>
        <p className="max-w-[380px] text-center text-[15px] leading-[22px] text-muted-soft">
          C'est le seul identifiant dont tu as besoin. On te donnera ensuite un code unique pour te
          reconnecter.
        </p>

        <div className="mt-2 w-full">
          <PillInput
            label="Pseudo"
            inputSize="lg"
            placeholder="FalconRouge92"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            hint="3 à 20 caractères, visible par les autres joueurs."
            error={error}
            autoFocus
            maxLength={20}
          />
        </div>

        <PillButton type="submit" size="lg" full disabled={username.trim().length < 3 || loading}>
          {loading ? 'Création…' : 'Continuer'}
          <span className="text-lg">→</span>
        </PillButton>

        <span className="mt-1.5 text-[13px] text-muted">
          Déjà un compte ?{' '}
          <Link to="/login" className="font-semibold text-citron hover:underline">
            Se connecter
          </Link>
        </span>
      </form>
    </div>
  )
}
