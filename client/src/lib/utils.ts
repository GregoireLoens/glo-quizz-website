export const AVATAR_COLORS = ['#F5F3EC', '#9C8DF2', '#F0492E', '#C7F45C']

export function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase()
}

export function avatarColor(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function formatPoints(n: number): string {
  return n.toLocaleString('fr-FR')
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
