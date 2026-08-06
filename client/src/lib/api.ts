import { useAuthStore } from '../stores/authStore'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    let code = 'error'
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') code = body.detail
    } catch {
      // corps non-JSON, on garde le code générique
    }
    if (res.status === 401 && token && !path.startsWith('/api/auth/login')) {
      useAuthStore.getState().logout()
    }
    throw new ApiError(res.status, code)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// GET et POST suffisent : l'API n'expose plus ni PUT ni DELETE depuis le retrait de
// l'édition de quiz (le reste du site ne fait que lire le catalogue et créer des parties).
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
}
