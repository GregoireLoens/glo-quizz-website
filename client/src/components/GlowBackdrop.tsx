interface Glow {
  color: string
  size: number
  opacity: number
  blur?: number
  top?: number | string
  left?: number | string
  right?: number | string
  bottom?: number | string
  centerX?: boolean
}

export const HOME_GLOWS: Glow[] = [
  { color: '#C7F45C', size: 520, opacity: 0.16, blur: 90, top: -180, right: -160 },
  { color: '#9C8DF2', size: 380, opacity: 0.14, blur: 80, top: 120, left: -140 },
  { color: '#F0492E', size: 420, opacity: 0.1, blur: 100, bottom: -200, right: 240 },
]

export const AUTH_GLOWS: Glow[] = [
  { color: '#9C8DF2', size: 520, opacity: 0.14, blur: 95, top: -180, right: -160 },
  { color: '#C7F45C', size: 460, opacity: 0.12, blur: 100, bottom: -220, left: -140 },
]

export const LOBBY_GLOWS: Glow[] = [
  { color: '#9C8DF2', size: 460, opacity: 0.15, blur: 90, top: -160, left: -120 },
  { color: '#F0492E', size: 480, opacity: 0.12, blur: 100, bottom: -220, right: -140 },
]

export const GAME_GLOWS: Glow[] = [
  { color: '#C7F45C', size: 560, opacity: 0.1, blur: 110, top: -180, centerX: true },
]

export const RESULT_GLOWS: Glow[] = [
  { color: '#C7F45C', size: 500, opacity: 0.14, blur: 100, top: -200, left: -100 },
  { color: '#F0492E', size: 440, opacity: 0.12, blur: 95, top: -160, right: -160 },
]

export function GlowBackdrop({ glows = HOME_GLOWS }: { glows?: Glow[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {glows.map((g, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: g.size,
            height: g.size,
            background: g.color,
            opacity: g.opacity,
            filter: `blur(${g.blur ?? 90}px)`,
            top: g.top,
            bottom: g.bottom,
            right: g.right,
            ...(g.centerX
              ? { left: '50%', transform: 'translateX(-50%)' }
              : { left: g.left }),
          }}
        />
      ))}
    </div>
  )
}
