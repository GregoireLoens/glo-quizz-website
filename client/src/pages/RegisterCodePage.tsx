import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { GlowBackdrop, GAME_GLOWS } from '../components/GlowBackdrop'
import { NavPill } from '../components/NavPill'
import { PillButton } from '../components/PillButton'

function downloadCodeImage(code: string, username: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 450
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#211F1A'
  ctx.fillRect(0, 0, 800, 450)
  ctx.fillStyle = '#28261F'
  ctx.beginPath()
  ctx.roundRect(60, 90, 680, 270, 28)
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#C7F45C'
  ctx.font = '600 26px Fredoka, sans-serif'
  ctx.fillText('midi quizz', 400, 60)
  ctx.fillStyle = '#9C9788'
  ctx.font = '600 16px Inter, sans-serif'
  ctx.fillText(`CODE UNIQUE DE ${username.toUpperCase()}`, 400, 160)
  ctx.fillStyle = '#F5F3EC'
  ctx.font = '600 72px Fredoka, sans-serif'
  ctx.fillText(code, 400, 260)
  ctx.fillStyle = '#787468'
  ctx.font = '400 15px Inter, sans-serif'
  ctx.fillText('Garde ce code précieusement : il ne sera plus jamais affiché.', 400, 320)
  const link = document.createElement('a')
  link.download = `midi-quizz-code-${username}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export function RegisterCodePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { code?: string; username?: string } | null
  const [checked, setChecked] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!state?.code || !state.username) return <Navigate to="/register" replace />
  const { code, username } = state

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop glows={GAME_GLOWS} />
      <NavPill variant="auth" />

      <div className="relative mx-auto mt-[60px] flex w-full max-w-[560px] flex-col items-center gap-4 pb-20">
        <span className="text-[40px]">🎉</span>
        <h1 className="text-center font-display text-[34px] font-semibold text-cream">
          Bienvenue, {username} !
        </h1>
        <p className="max-w-[420px] text-center text-[15px] leading-[22px] text-muted-soft">
          Voici ton code unique. C'est ta seule clé pour te reconnecter — il ne s'affichera plus
          jamais.
        </p>

        <div className="mt-2 flex flex-col items-center gap-2 rounded-[28px] bg-card px-10 py-7">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">
            Ton code unique
          </span>
          <span className="font-display text-[44px] font-semibold tracking-[6px] text-cream">
            {code}
          </span>
        </div>

        <div className="mt-1 flex gap-3">
          <PillButton variant="cream" onClick={copy}>
            {copied ? 'Copié ✓' : 'Copier le code'}
          </PillButton>
          <PillButton variant="outline" onClick={() => downloadCodeImage(code, username)}>
            Télécharger en image
          </PillButton>
        </div>

        <div className="mt-3.5 flex items-center gap-2.5 rounded-2xl bg-coral/12 px-4.5 py-3">
          <span className="text-lg">⚠️</span>
          <span className="text-[12.5px] leading-[17px] text-coral-soft">
            Personne ne pourra te le renvoyer si tu le perds — note-le dans un endroit sûr.
          </span>
        </div>

        <button
          type="button"
          onClick={() => setChecked((v) => !v)}
          className="mt-4 flex cursor-pointer items-center gap-2.5"
        >
          <span
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-md border-[1.5px] border-citron ${
              checked ? 'bg-citron' : ''
            }`}
          >
            {checked && <span className="text-[13px] font-bold text-ink">✓</span>}
          </span>
          <span className="text-[13.5px] text-cream">J'ai bien noté mon code</span>
        </button>

        <PillButton size="lg" full disabled={!checked} onClick={() => navigate('/')} className="mt-2">
          Commencer à jouer
          <span className="text-lg">→</span>
        </PillButton>
      </div>
    </div>
  )
}
