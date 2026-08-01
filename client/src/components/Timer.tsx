import { useEffect, useState } from 'react'

interface Props {
  duration: number
  startedAt: number // Date.now() en ms
  size?: number
}

/** Remplace CircularTimer : même contrat (duration/startedAt), rendu en anneau SVG plutôt qu'en
 * conic-gradient, et prend la couleur d'urgence (citron → or → corail sous 5s, pulse). */
export function Timer({ duration, startedAt, size = 104 }: Props) {
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

  const radius = (size - 10) / 2
  const circumference = 2 * Math.PI * radius
  const percent = duration > 0 ? remaining / duration : 0
  const urgent = remaining <= 5
  const color = urgent ? 'var(--color-coral)' : remaining <= 10 ? 'var(--color-gold)' : 'var(--color-citron)'

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-line-strong)" strokeWidth={5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent)}
          className="transition-[stroke-dashoffset] duration-[900ms] ease-linear"
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-display font-semibold tabular-nums ${urgent ? 'animate-pulse' : ''}`}
        style={{ fontSize: Math.round(size * 0.32), color }}
      >
        {Math.ceil(remaining)}
      </span>
    </div>
  )
}
