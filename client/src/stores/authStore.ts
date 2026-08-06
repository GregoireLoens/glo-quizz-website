import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { User } from '../lib/types'

interface AuthState {
  token: string | null
  user: User | null
  setSession: (token: string, user: User) => void
  /** Rafraîchit le profil sans toucher au token (changement d'avatar, retour de /me). */
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'midi-quizz-auth' },
  ),
)
