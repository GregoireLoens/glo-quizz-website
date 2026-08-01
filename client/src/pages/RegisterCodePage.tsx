import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { GlowBackdrop } from '../components/GlowBackdrop'
import { Icon } from '../components/Icon'
import { NavBar } from '../components/NavBar'

function downloadCodeImage(code: string, username: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 450
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#14120D'
  ctx.fillRect(0, 0, 800, 450)
  ctx.fillStyle = '#262218'
  ctx.beginPath()
  ctx.roundRect(60, 90, 680, 270, 28)
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#C9F45E'
  ctx.font = '600 26px Fredoka, sans-serif'
  ctx.fillText('midi quizz', 400, 60)
  ctx.fillStyle = '#A29C8B'
  ctx.font = '600 16px Inter, sans-serif'
  ctx.fillText(`CODE UNIQUE DE ${username.toUpperCase()}`, 400, 160)
  ctx.fillStyle = '#F7F5EE'
  ctx.font = '600 72px Fredoka, sans-serif'
  ctx.fillText(code, 400, 260)
  ctx.fillStyle = '#7E7868'
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
      <GlowBackdrop color="var(--color-citron)" x="50%" y="-4%" size={720} opacity={0.12} />
      <NavBar variant="auth" />

      <div className="relative mx-auto mt-[60px] flex w-full max-w-[560px] flex-col items-center gap-4 pb-20">
        <span className="text-[40px]">🎉</span>
        <h1 className="text-center font-display text-[28px] font-semibold text-cream sm:text-[34px]">
          Bienvenue, {username} !
        </h1>
        <p className="max-w-[420px] text-center text-[15px] leading-[22px] text-muted-soft">
          Voici ton code unique. C'est ta seule clé pour te reconnecter — il ne s'affichera plus
          jamais.
        </p>

        <div className="mt-2 flex w-full max-w-full flex-col items-center gap-2 rounded-xl border border-line bg-card px-5 py-6 sm:w-auto sm:px-10 sm:py-7">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">
            Ton code unique
          </span>
          <span className="font-display text-[30px] font-semibold tracking-[3px] text-cream sm:text-[44px] sm:tracking-[6px]">
            {code}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap justify-center gap-3">
          <Button variant="contour" icon={<Icon name="copier" size={17} />} onClick={copy}>
            {copied ? 'Copié ✓' : 'Copier le code'}
          </Button>
          <Button variant="ghost" onClick={() => downloadCodeImage(code, username)}>
            Télécharger en image
          </Button>
        </div>

        <div className="mt-3.5 flex items-center gap-2.5 rounded-lg border border-coral/38 bg-coral/12 px-4.5 py-3">
          <span className="text-lg">⚠️</span>
          <span className="text-[12.5px] leading-[17px] text-coral">
            Personne ne pourra te le renvoyer si tu le perds — note-le dans un endroit sûr.
          </span>
        </div>

        <button
          type="button"
          onClick={() => setChecked((v) => !v)}
          className="mt-4 flex cursor-pointer items-center gap-2.5"
        >
          <span
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-[6px] border-[1.5px] border-citron ${
              checked ? 'bg-citron' : ''
            }`}
          >
            {checked && <span className="text-[13px] font-bold text-ink">✓</span>}
          </span>
          <span className="text-[13.5px] text-cream">J'ai bien noté mon code</span>
        </button>

        <Button size="hero" full disabled={!checked} onClick={() => navigate('/')} className="mt-2" iconRight="→">
          Commencer à jouer
        </Button>
      </div>
    </div>
  )
}
