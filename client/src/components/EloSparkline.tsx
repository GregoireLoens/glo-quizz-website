/** Courbe de progression Elo — le seul graphique du site.
 *
 * Série unique, donc **pas de légende** : le titre de la carte nomme la donnée. Les
 * étiquettes vivent en HTML autour du tracé, pas dans le SVG : mises à l'échelle avec
 * lui, elles devenaient illisibles sur un écran de 390 px. Le SVG ne porte donc que la
 * géométrie, étirée librement (`preserveAspectRatio="none"`) avec un trait qui, lui, ne
 * s'étire pas (`vectorEffect="non-scaling-stroke"`).
 *
 * Les chiffres portent les jetons de texte, jamais le citron : la couleur porte la ligne,
 * pas les valeurs. */
import { formatPoints } from '../lib/utils'

const START_ELO = 1000 // config.ELO_START côté serveur
const TOP = 8 // marge haute et basse, en unités de viewBox (0–100)

interface Props {
  /** Ratings dans l'ordre chronologique, du plus ancien au plus récent. */
  points: number[]
  /** Libellé associé à chaque point, pour le survol (« 3e sur 4 · 12 août »). */
  labels?: string[]
}

export function EloSparkline({ points, labels = [] }: Props) {
  if (points.length < 2) return null

  const lo = Math.min(...points, START_ELO)
  const hi = Math.max(...points, START_ELO)
  const span = hi - lo || 1
  const x = (i: number) => (i * 100) / (points.length - 1)
  const y = (v: number) => TOP + ((hi - v) * (100 - 2 * TOP)) / span

  const first = points[0]
  const last = points[points.length - 1]
  const step = 100 / (points.length - 1)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4 text-[13px]">
        <span className="text-muted-deep tabular-nums">départ {formatPoints(first)}</span>
        <span className="font-display text-lg font-semibold tabular-nums text-cream">
          {formatPoints(last)} Elo
        </span>
      </div>
      {/* px-1 : le repère de fin déborde d'un rayon au-delà du tracé */}
      <div className="relative px-1">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-[104px] w-full"
          role="img"
          aria-label={`Progression du rating Elo sur ${points.length - 1} parties classées, de ${first} à ${last}.`}
        >
          {/* repère du rating de départ, volontairement en retrait */}
          <line
            x1={0} x2={100} y1={y(START_ELO)} y2={y(START_ELO)}
            stroke="var(--color-line-strong)" strokeWidth={1} strokeDasharray="4 5"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={points.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke="var(--color-citron)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* couche de survol : une bande par point, bornée au tracé */}
          {points.map((v, i) => (
            <rect
              key={i}
              x={Math.max(0, x(i) - step / 2)}
              y={0}
              width={Math.min(100, x(i) + step / 2) - Math.max(0, x(i) - step / 2)}
              height={100}
              fill="transparent"
            >
              <title>{labels[i] ? `${formatPoints(v)} Elo — ${labels[i]}` : `${formatPoints(v)} Elo`}</title>
            </rect>
          ))}
        </svg>
        {/* repère de fin : en HTML, pour rester rond malgré l'étirement du SVG. L'anneau
            de 2 px à la couleur de surface le garde lisible même posé sur la ligne. */}
        <span
          className="pointer-events-none absolute h-2 w-2 -translate-y-1/2 rounded-full bg-citron ring-2 ring-card"
          style={{ right: 0, top: `${y(last)}%` }}
        />
      </div>
    </div>
  )
}
