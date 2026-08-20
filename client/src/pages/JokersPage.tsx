import { Link } from 'react-router-dom'

import { Card } from '../components/Card'
import { GlowBackdrop } from '../components/GlowBackdrop'
import { NavBar } from '../components/NavBar'
import { JOKERS } from '../lib/jokers'

const TONE: Record<string, { title: string; badge: string }> = {
  citron: { title: 'text-citron', badge: 'bg-citron/12' },
  violet: { title: 'text-violet', badge: 'bg-violet/12' },
  coral: { title: 'text-coral', badge: 'bg-coral/12' },
}

/** Règles des jokers. Page publique et indexable : c'est du contenu de jeu, pas du compte.
 * Ouverte dans un onglet à part depuis le salon et la partie, pour qu'on puisse la lire
 * sans quitter une partie en cours. */
export function JokersPage() {
  return (
    <div className="relative min-h-screen overflow-hidden px-6">
      <GlowBackdrop color="var(--color-violet)" x="50%" y="-4%" size={640} opacity={0.13} />
      <NavBar />

      <div className="relative mx-auto flex max-w-[760px] flex-col gap-6 pb-20 pt-12 sm:pt-16">
        <div className="flex flex-col gap-3">
          <span className="inline-flex h-[30px] w-fit items-center gap-2 rounded-full bg-violet/14 px-3.5 text-xs font-semibold uppercase tracking-[1.5px] text-violet">
            Règles du jeu
          </span>
          <h1 className="font-display text-[34px] font-semibold leading-[1.05] tracking-[-0.5px] text-cream sm:text-[48px]">
            Les jokers
          </h1>
          <p className="max-w-[560px] text-base leading-[25px] text-muted-soft">
            Trois jokers par joueur et par partie, un de chaque. Ils se remettent à neuf à chaque
            manche, tout le monde a exactement les mêmes, et une partie avec jokers reste une partie
            classée.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {JOKERS.map((j) => (
            <Card key={j.kind} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 flex-none items-center justify-center rounded-full text-xl ${TONE[j.tone].badge}`}
                >
                  {j.emoji}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className={`font-display text-xl font-semibold ${TONE[j.tone].title}`}>
                    {j.label}
                  </span>
                  <span className="text-sm text-muted-soft">{j.effect}</span>
                </div>
              </div>
              <p className="text-[15px] leading-[25px] text-cream-soft">{j.detail}</p>
              {j.risk && (
                <p className="rounded-lg bg-cream/5 px-4 py-3 text-sm text-muted">
                  <strong className="font-semibold text-cream-soft">Ce que ça coûte :</strong> {j.risk}
                </p>
              )}
            </Card>
          ))}
        </div>

        <Card className="flex flex-col gap-4">
          <span className="font-display text-xl font-semibold text-cream">Bon à savoir</span>
          <ul className="flex flex-col gap-3 text-[15px] leading-[24px] text-cream-soft">
            <li>
              <strong className="font-semibold text-cream">Aucun joker ne donne de points.</strong>{' '}
              Le classement d'une partie se joue au nombre de bonnes réponses ; les points, eux, ne
              départagent que les ex æquo. Un joker « points doublés » ne pourrait donc faire passer
              devant personne — les trois jokers agissent sur les bonnes réponses ou sur la capacité
              d'un adversaire à en trouver une.
            </li>
            <li>
              <strong className="font-semibold text-cream">Un joker se joue avant de valider.</strong>{' '}
              Une fois ta réponse partie, il ne changerait plus rien : le serveur le refuse plutôt
              que de te le faire brûler pour rien.
            </li>
            <li>
              <strong className="font-semibold text-cream">Tout le monde voit tout.</strong> Les
              jokers qu'il reste à chacun sont publics, et un joker joué est annoncé à toute la
              table. Savoir que ton voisin garde encore son brouillage fait partie de la partie.
            </li>
            <li>
              <strong className="font-semibold text-cream">Le chrono ne bouge jamais.</strong> Aucun
              joker n'ajoute ni ne retire de temps : la question se termine au même instant pour
              tout le monde, sinon les autres joueurs attendraient devant un écran figé.
            </li>
            <li>
              <strong className="font-semibold text-cream">L'hôte peut les couper.</strong> Le
              réglage « Jokers » du salon accepte « Avec » ou « Sans » — sans eux, la partie se joue
              exactement comme avant.
            </li>
          </ul>
        </Card>

        <Link
          to="/"
          className="text-sm font-medium text-muted underline underline-offset-2 hover:text-cream"
        >
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}
