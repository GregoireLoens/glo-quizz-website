import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { GlowBackdrop, LOBBY_GLOWS } from '../components/GlowBackdrop'
import { NavPill } from '../components/NavPill'
import { PillButton } from '../components/PillButton'
import { api, ApiError } from '../lib/api'
import type { GameInfo } from '../lib/types'
import { normalizeGameCode } from '../lib/utils'

export function JoinPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || code.length < 6) return
    setError(null)
    setBusy(true)
    try {
      const info = await api.get<GameInfo>(`/api/games/${code}`)
      if (!info.joinable) {
        setError('Cette partie a déjà commencé — demande un nouveau salon à ton hôte.')
        return
      }
      navigate(`/game/${code}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("Aucune partie avec ce code. Vérifie qu'il est encore valide.")
      } else {
        setError('Impossible de vérifier le code pour le moment.')
      }
    } finally {
      setBusy(false)
    }
  }

  const createGame = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await api.post<{ code: string }>('/api/games', {})
      navigate(`/game/${res.code}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop glows={LOBBY_GLOWS} />
      <NavPill />

      <form
        onSubmit={join}
        className="relative mx-auto mt-20 flex w-full max-w-[440px] flex-col items-center gap-[22px] pb-20"
      >
        <h1 className="text-center font-display text-[40px] font-semibold text-cream">
          Rejoindre une partie
        </h1>
        <p className="text-center text-[15px] leading-[22px] text-muted-soft">
          Entre le code à 6 caractères partagé par l'hôte du salon.
        </p>

        <input
          value={code}
          onChange={(e) => {
            setCode(normalizeGameCode(e.target.value))
            setError(null)
          }}
          placeholder="XK4P9Q"
          autoFocus
          className={`h-20 w-full rounded-full border-[1.5px] bg-card text-center font-display text-4xl font-semibold tracking-[10px] text-cream outline-none transition placeholder:text-muted-deep/50 focus:border-citron/60 ${
            error ? 'border-coral' : 'border-cream/15'
          }`}
        />
        {error && <span className="text-center text-[13px] font-medium text-coral">{error}</span>}

        <PillButton type="submit" size="lg" full disabled={busy || code.length < 6}>
          Rejoindre
          <span className="text-lg">→</span>
        </PillButton>

        <div className="mt-2 flex items-center gap-3 self-stretch">
          <div className="h-px flex-1 bg-cream/10" />
          <span className="text-xs uppercase tracking-wider text-muted-deep">ou</span>
          <div className="h-px flex-1 bg-cream/10" />
        </div>

        <PillButton variant="outline" size="lg" full onClick={createGame} disabled={busy}>
          Créer un salon
        </PillButton>
      </form>
    </div>
  )
}
