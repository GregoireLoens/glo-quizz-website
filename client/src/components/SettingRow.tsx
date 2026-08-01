import type { ReactNode } from 'react'

interface Props {
  label: string
  hint?: string
  first?: boolean
  children: ReactNode
}

/** Panneau de réglages à lignes — libellé et sous-titre à gauche, contrôle à droite, filet entre
 * chaque ligne. Remplace la barre unique qui s'empilait n'importe comment. */
export function SettingRow({ label, hint, first = false, children }: Props) {
  return (
    <div className={`flex items-center gap-6 py-4 ${first ? '' : 'border-t border-line'}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-base font-semibold text-cream">{label}</span>
        {hint && <span className="text-sm text-muted-soft">{hint}</span>}
      </div>
      <div className="flex flex-none items-center gap-2.5">{children}</div>
    </div>
  )
}
