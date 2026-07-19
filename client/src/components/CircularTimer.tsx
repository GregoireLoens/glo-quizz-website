import { useEffect, useState } from 'react'

interface Props {
  duration: number
  startedAt: number // Date.now() en ms
  size?: number
}

export function CircularTimer({ duration, startedAt, size = 96 }: Props) {
  const [remaining, setRemaining] = useState(duration)

  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000
      setRemaining(Math.max(0, duration - elapsed))
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [duration, startedAt])

  const percent = duration > 0 ? (remaining / duration) * 100 : 0
  const inner = size - 18

  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(#C7F45C 0% ${percent}%, rgba(245,243,236,.1) ${percent}% 100%)`,
      }}
    >
      <div
        className="flex items-center justify-center rounded-full bg-ink"
        style={{ width: inner, height: inner }}
      >
        <span className="font-display text-2xl font-semibold tabular-nums text-cream">
          {Math.ceil(remaining)}
        </span>
      </div>
    </div>
  )
}
