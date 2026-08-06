import type { ReactNode } from 'react'

import type { AvatarColor, AvatarSymbol } from '../lib/avatar'
import { Avatar } from './Avatar'

interface Props {
  emoji: string
  category: string
  title: string
  meta: string
  author: string
  initials: string
  authorColor?: AvatarColor | string | null
  authorSymbol?: AvatarSymbol | null
  accent?: string
  action?: ReactNode
}

export function QuizCard({
  emoji,
  category,
  title,
  meta,
  author,
  initials,
  authorColor,
  authorSymbol,
  accent = 'var(--color-citron)',
  action,
}: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5 transition-colors hover:bg-card-2">
      <div className="flex items-center gap-3">
        <div
          className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-md text-[26px]"
          style={{ background: `color-mix(in oklab, ${accent} 15%, transparent)`, border: `1px solid color-mix(in oklab, ${accent} 30%, transparent)` }}
        >
          {emoji}
        </div>
        <span className="text-xs font-semibold uppercase tracking-[1.2px]" style={{ color: accent }}>
          {category}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="font-display text-xl font-semibold text-cream">{title}</span>
        <span className="text-sm text-muted-soft">{meta}</span>
      </div>
      <div className="mt-auto flex items-center gap-2.5 border-t border-line pt-3.5">
        <Avatar initials={initials} name={author} color={authorColor} symbol={authorSymbol} size={28} />
        <span className="flex-1 truncate text-sm text-muted">{author}</span>
        {action}
      </div>
    </div>
  )
}
