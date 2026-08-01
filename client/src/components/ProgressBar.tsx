interface Props {
  current: number
  total: number
  label?: string
  color?: string
  className?: string
}

export function ProgressBar({ current, total, label, color = 'var(--color-citron)', className = '' }: Props) {
  const percent = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0
  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      <div className="flex justify-between text-xs font-semibold uppercase tracking-[1px]">
        <span className="text-muted">{label ?? `Question ${current} sur ${total}`}</span>
        <span className="text-muted-soft">{Math.round(percent * 100)} %</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full border border-line bg-ink-2">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${percent * 100}%`, background: color }}
        />
      </div>
    </div>
  )
}
