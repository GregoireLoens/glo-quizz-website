import { useAuthStore } from "../stores/authStore";
import { useGameStore } from "../stores/gameStore";
import type { ClientMessage, ServerMessage } from "./types";

const WATCHDOG_TIMEOUT_MS = 25_000;

const FATAL_CODES: Record<number, string> = {
  4001: "invalid_token",
  4003: "already_started",
  4004: "room_not_found",
  4005: "room_closed",
};

class GameSocket {
  private ws: WebSocket | null = null;
  private code = "";
  private manuallyClosed = false;
  private retryDelay = 500;
  private retryTimer: number | null = null;
  private watchdogTimer: number | null = null;

  connect(code: string) {
    this.close();
    this.code = code.toUpperCase();
    this.manuallyClosed = false;
    this.retryDelay = 500;
    const store = useGameStore.getState();
    store.setCode(this.code);
    store.setConnection("connecting");
    this.open();
  }

  private open() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    // Pas de token dans l'URL : il est envoyé en premier message une fois la socket ouverte.
    const ws = new WebSocket(
      `${proto}://${location.host}/ws/game/${this.code}`,
    );
    this.ws = ws;

    ws.onopen = () => {
      this.retryDelay = 500;
      const token = useAuthStore.getState().token ?? "";
      ws.send(JSON.stringify({ type: "auth", token }));
      this.armWatchdog(ws);
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      // Tous les messages, y compris le ping applicatif, prouvent que la socket vit.
      this.armWatchdog(ws);
      try {
        useGameStore.getState().apply(JSON.parse(event.data) as ServerMessage);
      } catch {
        // message illisible, ignoré
      }
    };

    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.clearWatchdog();
      this.ws = null;
      if (this.manuallyClosed) return;
      if (event.code === 4000) {
        useGameStore.getState().setConnection("replaced");
        return;
      }
      const fatal = FATAL_CODES[event.code];
      if (fatal) {
        // Salon introuvable alors qu'on y jouait : ce n'est pas un mauvais code, c'est
        // le salon qui a disparu du serveur — typiquement un redémarrage, l'état des
        // parties vivant en mémoire. Dire « cette partie n'existe pas » serait faux.
        const joined = useGameStore.getState().youId !== null;
        useGameStore
          .getState()
          .setEnded(
            fatal === "room_not_found" && joined ? "game_interrupted" : fatal,
          );
        return;
      }
      useGameStore.getState().setConnection("reconnecting");
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.retryTimer !== null || this.manuallyClosed) return;
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 5000);
  }

  private armWatchdog(ws: WebSocket) {
    this.clearWatchdog();
    this.watchdogTimer = window.setTimeout(() => {
      this.watchdogTimer = null;
      if (this.ws !== ws || this.manuallyClosed) return;
      // La fermeture d'une socket half-open peut ne jamais produire onclose : on
      // programme donc nous-même la tentative, tout en réutilisant son backoff + auth.
      useGameStore.getState().setConnection("reconnecting");
      this.ws = null;
      ws.close();
      this.scheduleReconnect();
    }, WATCHDOG_TIMEOUT_MS);
  }

  private clearWatchdog() {
    if (this.watchdogTimer !== null) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close() {
    this.manuallyClosed = true;
    this.clearWatchdog();
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

export const gameSocket = new GameSocket();
