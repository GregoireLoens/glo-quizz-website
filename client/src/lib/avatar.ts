/** Marque du joueur — miroir client de `server/app/avatar.py` (les deux listes doivent
 * rester identiques : le serveur refuse toute valeur hors palette). La couleur est choisie
 * par le joueur, le symbole remplace ses initiales, et l'anneau or/argent/bronze du top 3
 * ne se choisit pas — il se déduit du classement à l'affichage. */

export const AVATAR_COLORS = ['citron', 'jade', 'lagon', 'violet', 'rose', 'abricot'] as const
export type AvatarColor = (typeof AVATAR_COLORS)[number]

export const AVATAR_SYMBOLS = ['trophee', 'vie', 'serie', 'minuteur', 'jouer', 'clavier'] as const
export type AvatarSymbol = (typeof AVATAR_SYMBOLS)[number]

const COLOR_SET: readonly string[] = AVATAR_COLORS

/** Token de couleur d'un avatar. Retombe sur citron pour une session d'avant l'avatar
 * (localStorage) ou une valeur inconnue — jamais de couleur en dur ailleurs. */
export function avatarColorVar(color?: string | null): string {
  return `var(--color-av-${color && COLOR_SET.includes(color) ? color : 'citron'})`
}

export const AVATAR_COLOR_LABELS: Record<AvatarColor, string> = {
  citron: 'Citron',
  jade: 'Jade',
  lagon: 'Lagon',
  violet: 'Violet',
  rose: 'Rose',
  abricot: 'Abricot',
}

export const AVATAR_SYMBOL_LABELS: Record<AvatarSymbol, string> = {
  trophee: 'Trophée',
  vie: 'Cœur',
  serie: 'Éclair',
  minuteur: 'Minuteur',
  jouer: 'Lecture',
  clavier: 'Clavier',
}
