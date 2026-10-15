import { useSyncExternalStore } from 'react'
import type { Session } from '@/contracts/api'

/** Sessão do cliente (token + usuário). A validade é sempre decidida pela API. */
const SESSION_KEY = 'kurio.session'
const GUEST_KEY = 'kurio.guestId'

type Listener = () => void
const listeners = new Set<Listener>()

function read(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

let current = read()

export const getSession = () => current

let endReason: 'expired' | null = null

/** Motivo do último encerramento involuntário (lido uma vez pela tela de login). */
export function consumeEndReason() {
  const reason = endReason
  endReason = null
  return reason
}

export function setSession(session: Session | null, reason: 'expired' | null = null): void {
  current = session
  endReason = reason
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Sem storage: a sessão vale só para esta aba.
  }
  listeners.forEach((l) => l())
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Login/logout em outra aba.
window.addEventListener('storage', (event) => {
  if (event.key !== SESSION_KEY) return
  current = read()
  listeners.forEach((l) => l())
})

export const useSession = () => useSyncExternalStore(subscribeSession, getSession)

/** Identificador estável do visitante, usado para o carrinho antes do login. */
export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(GUEST_KEY, id)
  }
  return id
}
