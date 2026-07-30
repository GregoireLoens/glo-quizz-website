import type { ReactNode } from 'react'

import type { MedalRank } from '../stores/leadersStore'

// Classes littérales : le JIT Tailwind ne voit pas un nom de couleur construit à la volée.
const METAL = {
  1: { bg: 'bg-gold', ring: 'border-gold', label: '1er au classement général' },
  2: { bg: 'bg-silver', ring: 'border-silver', label: '2ᵉ au classement général' },
  3: { bg: 'bg-bronze', ring: 'border-bronze', label: '3ᵉ au classement général' },
} as const

// Pastille dessinée plutôt qu'un emoji 🥇 : les glyphes médaille sont surtout du ruban
// (bleu, hors palette) et le disque devient illisible sous 40 px.
const SIZES = {
  sm: { ring: '-inset-[3px]', disc: 15, font: 9, offset: '-bottom-0.5 -right-0.5' },
  md: { ring: '-inset-[4px]', disc: 21, font: 12, offset: '-bottom-1 -right-1' },
  lg: { ring: '-inset-[4px]', disc: 26, font: 15, offset: '-bottom-1 -right-1' },
} as const

interface Props {
  rank: MedalRank | null
  /** Calé sur le diamètre de la bulle : sm ≈ 32px, md ≈ 44–56px, lg ≥ 64px. */
  size?: keyof typeof SIZES
  /** À couper sous ~30px : la pastille y mange la bulle, l'anneau seul suffit à marquer. */
  badge?: boolean
  children: ReactNode
}

/**
 * Anneau métal + pastille de rang autour d'une bulle d'avatar : marque les 3 premiers du
 * classement général, à l'identique partout dans l'app.
 *
 * L'anneau est posé en absolu (`-inset-*`) plutôt qu'en padding : il déborde à l'extérieur
 * sans rien décaler dans les listes, et reste *hors* du `ring` de l'Avatar, qui garde ses
 * propres sens (citron = prêt / c'est toi, dashed = déconnecté).
 */
export function MedalRing({ rank, size = 'md', badge = true, children }: Props) {
  if (rank === null) return <>{children}</>
  const metal = METAL[rank]
  const s = SIZES[size]
  return (
    <div className="relative flex-none" title={metal.label}>
      {children}
      <span
        className={`pointer-events-none absolute ${s.ring} rounded-full border-2 ${metal.ring}`}
      />
      {badge && (
        <span
          className={`pointer-events-none absolute ${s.offset} flex items-center justify-center rounded-full border-2 border-ink font-display font-semibold leading-none text-ink ${metal.bg}`}
          style={{ width: s.disc, height: s.disc, fontSize: s.font }}
        >
          {rank}
        </span>
      )}
    </div>
  )
}
