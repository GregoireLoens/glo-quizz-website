interface Option<T> {
  label: string
  value: T
}

interface Props<T> {
  options: Option<T>[]
  value: T
  onChange?: (value: T) => void
  disabled?: boolean
  full?: boolean
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  full = false,
}: Props<T>) {
  return (
    <div className={`inline-flex gap-1 rounded-full border border-line bg-ink-2 p-1 ${full ? 'w-full' : ''}`}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(opt.value)}
            className={`h-9 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-sm transition disabled:cursor-default sm:px-[18px] ${
              full ? 'flex-1' : ''
            } ${active ? 'bg-citron font-semibold text-ink' : 'text-muted-soft enabled:hover:text-cream'}`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
