import { useAuthStore } from '../stores/authStore'
import { useGameStore } from '../stores/gameStore'
import type { ClientMessage, ServerMessage } from './types'

const FATAL_CODES: Record<number, string> = {
  4001: 'invalid_token',
  4003: 'already_started',
  4004: 'room_not_found',
  4005: 'room_closed',
}

class GameSocket {
  private ws: WebSocket | null = null
  private code = ''
  private manuallyClosed = false
  private retryDelay = 500
  private retryTimer: number | null = null

  connect(code: string) {
    this.close()
    this.code = code.toUpperCase()
    this.manuallyClosed = false
    this.retryDelay = 500
    const store = useGameStore.getState()
    store.setCode(this.code)
    store.setConnection('connecting')
    this.open()
  }

  private open() {
    const token = useAuthStore.getState().token ?? ''
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(
      `${proto}://${location.host}/ws/game/${this.code}?token=${encodeURIComponent(token)}`,
    )
    this.ws = ws

    ws.onopen = () => {
      this.retryDelay = 500
      useGameStore.getState().setConnection('open')
    }

    ws.onmessage = (event) => {
      try {
        useGameStore.getState().apply(JSON.parse(event.data) as ServerMessage)
      } catch {
        // message illisible, ignoré
      }
    }

    ws.onclose = (event) => {
      if (this.ws !== ws) return
      this.ws = null
      if (this.manuallyClosed) return
      if (event.code === 4000) return // remplacé par une connexion plus récente (autre onglet)
      const fatal = FATAL_CODES[event.code]
      if (fatal) {
        useGameStore.getState().setEnded(fatal)
        return
      }
      useGameStore.getState().setConnection('reconnecting')
      this.retryTimer = window.setTimeout(() => this.open(), this.retryDelay)
      this.retryDelay = Math.min(this.retryDelay * 2, 5000)
    }
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  close() {
    this.manuallyClosed = true
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    this.ws?.close()
    this.ws = null
  }
}

export const gameSocket = new GameSocket()
