interface Props {
  initials: string
  name: string
  host?: boolean
  ready?: boolean
  /** Déconnecté (reconnexion WS en cours) — pas dans la maquette d'origine, ajouté : ce signal
   * existe réellement dans le jeu et ne doit pas se perdre dans la refonte. */
  pending?: boolean
  size?: number
}

export function PlayerBubble({ initials, name, host = false, ready = false, pending = false, size = 76 }: Props) {
  const on = host || ready
  const label = pending ? 'Déconnecté' : host ? 'Hôte' : ready ? 'Prêt' : 'En attente'
  return (
    <div className="flex flex-col items-center gap-2.5" style={{ width: size + 40 }}>
      <div
        className={`flex items-center justify-center rounded-full font-display font-semibold text-cream ${
          pending ? 'border-2 border-dashed border-line-strong opacity-40' : on ? 'border-2 border-citron' : 'border-2 border-line-strong'
        } bg-card`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
      >
        {initials}
      </div>
      <span className="max-w-full truncate text-sm font-semibold text-cream">{name}</span>
      <span
        className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[11px] font-semibold ${
          on && !pending ? 'bg-citron/14 text-citron' : 'bg-cream/7 text-muted-soft'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
