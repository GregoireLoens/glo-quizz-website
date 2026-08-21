import type { JokerKind } from './types'

/** Les jokers, source unique : barre de jeu, infobulle au survol et page de règles lisent
 * tous ce tableau. Un joker par axe — sûreté, risque, agression, parade — parce que
 * plusieurs exemplaires du même ne poseraient que la question « quand », là où des jokers
 * différents posent « lequel, quand, et contre qui ». */
export interface JokerInfo {
  kind: JokerKind
  label: string
  /** Libellé court, sous `sm` : les **quatre** boutons doivent tenir sur une seule ligne à
   * 390 px, sinon le dernier se retrouve sous la nav basse au premier affichage. */
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
    short: '50/50',
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
    kind: 'steal',
    label: 'Braquage',
    short: 'Vol',
    emoji: '💰',
    effect: 'Si ta cible trouve et pas toi, tu lui prends sa bonne réponse.',
    detail:
      "Tu désignes un adversaire. Au moment du décompte, s'il tient une bonne réponse et que toi non, elle change de camp : il en perd une, tu en gagnes une. « Tenir une bonne réponse », c'est avoir répondu juste — ou avoir soi-même réussi son braquage : le butin d'un braqueur se braque, et la bonne réponse file au dernier voleur. S'il n'a rien à prendre, ou si tu avais trouvé toi aussi, le joker est perdu — et l'écran te le dit. En Survie, un braquage qui aboutit te rend la vie que coûtait ta mauvaise réponse : tu finis la question une bonne réponse en main.",
    risk: "Perdu si ta cible se trompe, ou si tu trouves la réponse toi aussi.",
    tone: 'coral',
    needsTarget: true,
  },
  {
    kind: 'shield',
    label: 'Bouclier',
    short: 'Parer',
    emoji: '🛡️',
    effect: 'Annule les jokers joués contre toi sur cette question.',
    detail:
      "Posé sur une question, il annule tout ce qu'on te joue dessus — et l'assaillant perd son joker quand même. C'est le seul joker que la table **ne voit pas partir** : annoncé, il ne serait qu'un panneau « ne m'attaquez pas » et personne n'y perdrait rien. Il n'apparaît qu'au décompte. Revers de la médaille : si personne ne t'attaque ce tour-là, tu l'as brûlé pour rien. C'est un pari sur le moment où l'on va te viser.",
    risk: "Perdu si personne ne t'attaque sur cette question.",
    tone: 'silver',
    needsTarget: false,
  },
]

export const JOKER_BY_KIND: Record<JokerKind, JokerInfo> = Object.fromEntries(
  JOKERS.map((j) => [j.kind, j]),
) as Record<JokerKind, JokerInfo>

/** Le classement se joue au nombre de bonnes réponses, les points ne départageant que les
 * ex æquo : c'est pourquoi aucun joker ne donne de points — il n'aurait aucun poids. */
export const JOKERS_RULE =
  'Quatre jokers par joueur et par partie, un de chaque. Ils se remettent à neuf à chaque manche, et une partie avec jokers reste une partie classée.'
