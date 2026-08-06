import {
  AVATAR_COLOR_LABELS,
  AVATAR_COLORS,
  AVATAR_SYMBOL_LABELS,
  AVATAR_SYMBOLS,
  avatarColorVar,
  type AvatarColor,
  type AvatarSymbol,
} from '../lib/avatar'
import { initials } from '../lib/utils'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

interface Props {
  username: string
  color: AvatarColor
  symbol: AvatarSymbol | null
  onChange: (next: { color: AvatarColor; symbol: AvatarSymbol | null }) => void
  /** Diamètre de l'aperçu — 72 dans l'inscription, 64 dans le panneau de la nav. */
  previewSize?: number
}

/** Les deux axes que le joueur choisit lui-même : la couleur, et le symbole qui remplace ses
 * initiales. Le troisième — l'anneau du top 3 — se gagne, il n'a rien à faire ici. Contrôlé :
 * l'enregistrement (POST /api/auth/avatar) appartient à l'appelant. */
export function AvatarPicker({ username, color, symbol, onChange, previewSize = 72 }: Props) {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Avatar
        initials={initials(username)}
        name={username}
        color={color}
        symbol={symbol}
        size={previewSize}
      />

      <div className="flex w-full flex-col gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-[1.2px] text-muted">Couleur</span>
        <div className="flex flex-wrap gap-2.5">
          {AVATAR_COLORS.map((c) => {
            const on = c === color
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                aria-label={AVATAR_COLOR_LABELS[c]}
                title={AVATAR_COLOR_LABELS[c]}
                onClick={() => onChange({ color: c, symbol })}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full"
                style={{
                  background: `color-mix(in oklab, ${avatarColorVar(c)} ${on ? 28 : 13}%, transparent)`,
                  border: `${on ? 2 : 1}px solid color-mix(in oklab, ${avatarColorVar(c)} ${on ? 100 : 34}%, transparent)`,
                }}
              >
                <span
                  className="block h-5 w-5 rounded-full"
                  style={{ background: avatarColorVar(c) }}
                />
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-[1.2px] text-muted">Symbole</span>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            aria-pressed={symbol === null}
            aria-label="Mes initiales"
            title="Mes initiales"
            onClick={() => onChange({ color, symbol: null })}
            className={`flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full px-3 font-display text-sm font-semibold ${
              symbol === null ? 'border-2 border-citron bg-citron/13 text-citron' : 'border border-line-strong text-cream-soft hover:text-cream'
            }`}
          >
            {initials(username)}
          </button>
          {AVATAR_SYMBOLS.map((s) => {
            const on = s === symbol
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                aria-label={AVATAR_SYMBOL_LABELS[s]}
                title={AVATAR_SYMBOL_LABELS[s]}
                onClick={() => onChange({ color, symbol: s })}
                className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full ${
                  on ? 'border-2 border-citron bg-citron/13 text-citron' : 'border border-line-strong text-cream-soft hover:text-cream'
                }`}
              >
                <Icon name={s} size={20} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
