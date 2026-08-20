export function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase()
}

// La couleur d'avatar ne se devine plus depuis le pseudo : le joueur la choisit et le
// serveur la sert avec chaque joueur (voir lib/avatar.ts et server/app/avatar.py).

export function formatPoints(n: number): string {
  return n.toLocaleString('fr-FR')
}

/** Variation d'Elo, signe toujours visible : +24, -18, ±0. */
export function formatEloDelta(delta: number): string {
  if (delta === 0) return '±0'
  return delta > 0 ? `+${delta}` : `${delta}`
}

/** Rang en toutes lettres : 1er, puis 2e, 3e… (le féminin « 1re » n'a pas d'emploi ici,
 * les rangs qualifient toujours une place, jamais une personne). */
export function formatRank(n: number): string {
  return n === 1 ? '1er' : `${n}e`
}

/** Date d'une partie. `games.finished_at` vient de `datetime('now')` côté SQLite : de
 * l'UTC sans marqueur de fuseau, d'où le « Z » ajouté avant de parser — sinon le
 * navigateur le lit comme une heure locale et décale la date. */
export function formatGameDate(value: string | null): string {
  if (!value) return ''
  const d = new Date(`${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function formatPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`
  return `${n}`
}

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m} min ${s.toString().padStart(2, '0')} s` : `${s} s`
}

/** Code de partie : 6 caractères alphanumériques majuscules. */
export function normalizeGameCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}

/** Code utilisateur : XXXX-XXXX, tiret inséré automatiquement. */
export function formatUserCodeInput(value: string): string {
  const raw = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw
}
