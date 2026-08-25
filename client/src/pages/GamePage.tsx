import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/Button";
import { GlowBackdrop } from "../components/GlowBackdrop";
import { gameSocket } from "../lib/ws";
import { useGameStore } from "../stores/gameStore";
import { LobbyView } from "./game/LobbyView";
import { PlayingView } from "./game/PlayingView";
import { ResultsView } from "./game/ResultsView";

const END_MESSAGES: Record<string, string> = {
  room_not_found: "Cette partie n'existe pas ou est déjà terminée.",
  // Le salon a disparu pendant qu'on y jouait : l'état des parties vit en mémoire,
  // un redémarrage du serveur les emporte. Voir ws.ts.
  game_interrupted:
    "La partie a été interrompue : le salon n’existe plus côté serveur, ce qui arrive quand le site est mis à jour en cours de partie.",
  already_started: "La partie a déjà commencé sans toi.",
  room_closed: "Le salon a été fermé pour cause d’inactivité.",
  invalid_token: "Ta session a expiré — reconnecte-toi.",
};

const GLOWS: Record<
  string,
  { color: string; x: string; y: string; size: number; opacity: number }
> = {
  lobby: {
    color: "var(--color-citron)",
    x: "78%",
    y: "8%",
    size: 600,
    opacity: 0.12,
  },
  question: {
    color: "var(--color-citron)",
    x: "50%",
    y: "0%",
    size: 760,
    opacity: 0.12,
  },
  reveal: {
    color: "var(--color-coral)",
    x: "50%",
    y: "2%",
    size: 700,
    opacity: 0.1,
  },
  finished: {
    color: "var(--color-gold)",
    x: "50%",
    y: "6%",
    size: 720,
    opacity: 0.13,
  },
};

export function GamePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const connection = useGameStore((s) => s.connection);
  const endReason = useGameStore((s) => s.endReason);
  const phase = useGameStore((s) => s.phase);
  const youId = useGameStore((s) => s.youId);

  useEffect(() => {
    if (!code) return;
    gameSocket.connect(code);
    return () => {
      gameSocket.close();
      useGameStore.getState().reset();
    };
  }, [code]);

  if (connection === "replaced") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-6">
        <GlowBackdrop {...GLOWS.lobby} />
        <span className="relative text-[44px]">🖥️</span>
        <p className="relative max-w-md text-center text-lg text-cream-soft">
          Ce salon est ouvert sur un autre écran.
        </p>
        <Button onClick={() => code && gameSocket.connect(code)}>
          Reprendre la main
        </Button>
      </div>
    );
  }

  if (connection === "ended") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden px-6">
        <GlowBackdrop {...GLOWS.lobby} />
        <span className="relative text-[44px]">😕</span>
        <p className="relative max-w-md text-center text-lg text-cream-soft">
          {END_MESSAGES[endReason ?? ""] ??
            "La connexion à la partie a été interrompue."}
        </p>
        <div className="relative flex flex-wrap justify-center gap-3">
          <Button onClick={() => navigate("/join")}>
            Rejoindre une autre partie
          </Button>
          <Button variant="contour" onClick={() => navigate("/")}>
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  if (youId === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-cream/15 border-t-citron" />
        <span className="text-sm text-muted">
          {connection === "reconnecting"
            ? "Reconnexion…"
            : "Connexion au salon…"}
        </span>
      </div>
    );
  }

  const glow =
    GLOWS[
      phase === "question" || phase === "reveal"
        ? phase
        : phase === "finished"
          ? "finished"
          : "lobby"
    ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GlowBackdrop {...glow} />
      {connection === "reconnecting" && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-coral/90 px-5 py-2 text-[13px] font-semibold text-cream">
          Connexion perdue — reconnexion en cours…
        </div>
      )}
      {phase === "lobby" && <LobbyView />}
      {(phase === "question" || phase === "reveal") && <PlayingView />}
      {phase === "finished" && <ResultsView />}
    </div>
  );
}
