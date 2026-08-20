import { useEffect, useRef, useState } from 'react'

import type { AvatarColor, AvatarSymbol } from '../lib/avatar'
import { JOKERS } from '../lib/jokers'
import type { JokerKind } from '../lib/types'
import { initials } from '../lib/utils'
import { Avatar } from './Avatar'
import { Tooltip } from './Tooltip'

export interface JokerTarget {
  id: number
  username: string
  avatarColor: AvatarColor
  avatarSymbol: AvatarSymbol | null
}

interface Props {
  /** Jokers encore en main. */
  left: JokerKind[]
  /** Adversaires visables par le brouillage — déjà filtrés par l'appelant. */
  targets: JokerTarget[]
  /** Coupé pendant le reveal, après validation, ou pour un joueur éliminé. */
  disabled?: boolean
  /** « Double ou rien » déjà engagé sur cette question. */
  doubleActive?: boolean
  onPlay: (kind: JokerKind, targetId?: number) => void
}

// Tailwind ne compile pas une classe construite à la volée : les trois tons sont écrits en
// toutes lettres, avec les jetons du design system.
const TONE: Record<string, string> = {
  citron: 'border-citron/45 bg-citron/12 text-citron hover:bg-citron/20',
  violet: 'border-violet/45 bg-violet/12 text-violet hover:bg-violet/20',
  coral: 'border-coral/45 bg-coral/12 text-coral hover:bg-coral/20',
}

/** Les trois jokers pendant une partie. Un joker dépensé reste visible, éteint : savoir ce
 * qu'on a déjà brûlé fait partie de la lecture de la partie. */
export function JokerBar({ left, targets, disabled = false, doubleActive = false, onPlay }: Props) {
  const [picking, setPicking] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!picking) return
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicking(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [picking])

  useEffect(() => {
    if (disabled) setPicking(false)
  }, [disabled])

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {JOKERS.map((j) => {
        const spent = !left.includes(j.kind)
        const engaged = j.kind === 'double' && doubleActive
        const off = spent || disabled || (j.kind === 'scramble' && targets.length === 0)
        return (
          <Tooltip
            key={j.kind}
            label={
              spent
                ? `${j.label} — déjà utilisé.`
                : j.kind === 'scramble' && targets.length === 0
                  ? `${j.label} — aucun adversaire à viser.`
                  : j.effect
            }
          >
            <button
              type="button"
              disabled={off}
              aria-label={`${j.label} — ${j.effect}`}
              onClick={() => {
                if (!j.needsTarget) {
                  onPlay(j.kind)
                  return
                }
                // Un seul adversaire visable : le sélecteur n'a rien à demander, et
                // l'ouvrir coûtait les deux ou trois secondes qui suffisent à ce que la
                // cible réponde — auquel cas le joker n'est plus jouable du tout.
                if (targets.length === 1) {
                  onPlay(j.kind, targets[0].id)
                  return
                }
                setPicking((v) => !v)
              }}
              className={`flex h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition disabled:cursor-default sm:gap-2 sm:px-4 ${
                off ? 'border-line bg-cream/4 text-muted-deep opacity-60' : TONE[j.tone]
              } ${engaged ? 'ring-2 ring-violet/60' : ''}`}
            >
              <span className="text-base">{j.emoji}</span>
              <span className="hidden sm:inline">{j.label}</span>
              <span className="sm:hidden">{j.short}</span>
            </button>
          </Tooltip>
        )
      })}

      {picking && targets.length > 0 && (
        <div
          ref={pickerRef}
          className="absolute bottom-[calc(100%+12px)] left-1/2 z-30 flex w-[248px] -translate-x-1/2 flex-col gap-1 rounded-xl border border-line bg-ink p-2"
        >
          <span className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-[1.2px] text-muted">
            Brouiller qui ?
          </span>
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setPicking(false)
                onPlay('scramble', t.id)
              }}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-coral/15"
            >
              <Avatar
                initials={initials(t.username)}
                name={t.username}
                color={t.avatarColor}
                symbol={t.avatarSymbol}
                size={28}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-cream">{t.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
