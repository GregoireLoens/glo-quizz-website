import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string | null
  code?: boolean
  inputSize?: 'lg' | 'md'
}

export function PillInput({
  label,
  hint,
  error,
  code = false,
  inputSize = 'md',
  className = '',
  ...rest
}: Props) {
  return (
    <div className="flex w-full flex-col gap-2">
      {label && <span className="text-[12.5px] font-semibold text-muted">{label}</span>}
      <input
        className={`w-full rounded-full border-[1.5px] bg-card px-6 text-cream outline-none transition placeholder:text-muted-deep focus:border-citron/60 ${
          error ? 'border-coral' : 'border-cream/15'
        } ${inputSize === 'lg' ? 'h-[60px] text-[17px]' : 'h-14 text-base'} ${
          code ? 'font-display tracking-[3px]' : 'font-medium'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <span className="px-2 text-xs font-medium text-coral">{error}</span>
      ) : (
        hint && <span className="px-2 text-xs text-muted-deep">{hint}</span>
      )}
    </div>
  )
}
