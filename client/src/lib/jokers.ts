import type { JokerKind } from './types'

/** Les trois jokers, source unique : barre de jeu, infobulle au survol et page de règles
 * lisent tous ce tableau. Un joker par axe — sûreté, risque, agression — parce que trois
 * exemplaires du même ne poseraient que la question « quand », là où trois différents
 * posent « lequel, quand, et contre qui ». */
export interface JokerInfo {
  kind: JokerKind
  label: string
  /** Libellé court, sous `sm` : les trois boutons doivent tenir sur une ligne à 390 px. */
  short: string
  emoji: string
  /** Une ligne, affichée au survol dans la partie. */
  effect: string
  /** Le détail, sur la page de règles. */
  detail: string
  /** Ce que le joker coûte ou risque — nul pour le moitié-moitié. */
  risk: string | null
  /** Jeton de couleur du design system, jamais de valeur en dur. */
  tone: string
  /** Le joker désigne une cible avant de partir. */
  needsTarget: boolean
}

export const JOKERS: JokerInfo[] = [
  {
    kind: 'fifty',
    label: 'Moitié-moitié',
    short: 'Moitié',
    emoji: '🎯',
    effect: 'Deux mauvaises réponses disparaissent de ton écran.',
    detail:
      "Deux des trois mauvaises réponses s'effacent : il ne reste que la bonne et une intruse. Ta chance passe de 25 % à 50 %. C'est le joker de sûreté, celui qu'on garde pour la question qu'on ne sait vraiment pas — les deux réponses écartées sont tirées au sort par le serveur, qui ne dit jamais laquelle est la bonne.",
    risk: null,
    tone: 'citron',
    needsTarget: false,
  },
  {
    kind: 'double',
    label: 'Double ou rien',
    short: 'Double',
    emoji: '🎲',
    effect: 'Juste, la question compte double. Faux, elle compte −1.',
    detail:
      "Le pari s'annonce avant de valider. Bonne réponse, la question vaut deux bonnes réponses au classement ; mauvaise réponse, on t'en retire une — et ton total peut passer sous zéro. C'est le seul joker qui touche directement l'axe du classement, donc le seul vrai risque. En mode Survie, un pari perdu coûte deux vies au lieu d'une.",
    risk: 'Une bonne réponse en moins si tu te trompes, deux vies en Survie.',
    tone: 'violet',
    needsTarget: false,
  },
  {
    kind: 'scramble',
    label: 'Brouillage',
    short: 'Brouiller',
    emoji: '💥',
    effect: "Trois secondes de réponses mélangées pour l'adversaire de ton choix.",
    detail:
      "Tu désignes un joueur : pendant trois secondes, ses quatre réponses lui apparaissent mélangées et privées de leur lettre. Il peut toujours répondre, mais il doit tout relire — et le chrono, lui, continue. C'est le seul joker qui touche quelqu'un d'autre. Il se refuse sur un joueur qui a déjà validé, ou déjà éliminé en Survie : autant ne pas le gâcher.",
    risk: null,
    tone: 'coral',
    needsTarget: true,
  },
]

export const JOKER_BY_KIND: Record<JokerKind, JokerInfo> = Object.fromEntries(
  JOKERS.map((j) => [j.kind, j]),
) as Record<JokerKind, JokerInfo>

/** Le classement se joue au nombre de bonnes réponses, les points ne départageant que les
 * ex æquo : c'est pourquoi aucun joker ne donne de points — il n'aurait aucun poids. */
export const JOKERS_RULE =
  'Trois jokers par joueur et par partie, un de chaque. Ils se remettent à neuf à chaque manche, et une partie avec jokers reste une partie classée.'
