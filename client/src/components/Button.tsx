import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'citron' | 'contour' | 'ghost' | 'coral'
type Size = 'hero' | 'ecran' | 'secondaire' | 'compact'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  full?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  citron: 'bg-citron text-ink hover:brightness-105',
  contour: 'border-[1.5px] border-line-strong text-cream hover:bg-cream/6',
  ghost: 'text-muted hover:bg-cream/6 hover:text-cream',
  coral: 'border border-coral/38 bg-coral/12 text-coral hover:bg-coral/20',
}

// Hauteurs normalisées : 56 héros, 52 action d'écran, 44 secondaire, 38 dans une carte.
const SIZES: Record<Size, string> = {
  hero: 'h-14 px-[26px] text-[17px]',
  ecran: 'h-[52px] px-6 text-[16px]',
  secondaire: 'h-11 px-5 text-[15px]',
  compact: 'h-[38px] px-[17px] text-[14px]',
}

/** L'état désactivé passe par disabled:opacity-40 sur tout le contrôle — jamais un fond et un
 * texte atténués séparément, qui détruisent le contraste du libellé. */
export function Button({
  variant = 'citron',
  size = 'ecran',
  full = false,
  icon,
  iconRight,
  className = '',
  type = 'button',
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${full ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  )
}
