import type { ButtonHTMLAttributes } from 'react'

type Variant = 'citron' | 'outline' | 'cream' | 'ghost' | 'coral-ghost'
type Size = 'lg' | 'md' | 'sm'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  full?: boolean
}

const VARIANTS: Record<Variant, string> = {
  citron: 'bg-citron text-ink hover:brightness-105',
  outline: 'border-[1.5px] border-cream/35 text-cream hover:bg-cream/5',
  cream: 'bg-cream text-ink hover:brightness-95',
  ghost: 'text-muted hover:text-cream',
  'coral-ghost': 'text-coral hover:bg-coral/10',
}

const SIZES: Record<Size, string> = {
  lg: 'h-14 px-7 text-[15.5px]',
  md: 'h-12 px-6 text-sm',
  sm: 'h-9 px-[18px] text-[13.5px]',
}

export function PillButton({
  variant = 'citron',
  size = 'md',
  full = false,
  className = '',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${full ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  )
}
