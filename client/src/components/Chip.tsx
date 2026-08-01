import type { ReactNode } from 'react'

interface Props {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}

export function Chip({ active = false, onClick, children, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 cursor-pointer items-center whitespace-nowrap rounded-full px-4 text-sm transition ${
        active ? 'bg-cream font-semibold text-ink' : 'border border-line-strong text-cream-soft hover:border-cream/50'
      } ${className}`}
    >
      {children}
    </button>
  )
}
