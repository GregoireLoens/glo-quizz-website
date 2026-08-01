import type { HTMLAttributes } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> {
  tone?: 'card' | 'puits'
  interactive?: boolean
}

/** Surface `card`, ou puits `ink-2` pour ce qui doit se creuser sous la carte qui l'entoure
 * (champs, segmented control, tuiles de code). Aucune ombre portée — le relief vient du
 * contraste de fond et du filet `line`. */
export function Card({ tone = 'card', interactive = false, className = '', ...rest }: Props) {
  return (
    <div
      className={`rounded-xl border border-line p-6 transition-colors ${
        tone === 'puits' ? 'bg-ink-2' : interactive ? 'bg-card hover:bg-card-2' : 'bg-card'
      } ${interactive ? 'cursor-pointer' : ''} ${className}`}
      {...rest}
    />
  )
}
