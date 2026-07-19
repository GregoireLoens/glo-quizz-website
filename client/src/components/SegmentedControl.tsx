interface Option<T> {
  label: string
  value: T
}

interface Props<T> {
  options: Option<T>[]
  value: T
  onChange?: (value: T) => void
  disabled?: boolean
  boxed?: boolean
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  boxed = false,
}: Props<T>) {
  return (
    <div className={boxed ? 'inline-flex gap-2 rounded-[20px] bg-card p-1' : 'inline-flex gap-1.5'}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(opt.value)}
            className={`h-9 cursor-pointer rounded-full px-[18px] text-[13px] transition disabled:cursor-default ${
              active
                ? 'bg-citron font-semibold text-ink'
                : 'text-muted enabled:hover:text-cream'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
