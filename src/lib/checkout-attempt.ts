import type { CreateOrderRequest } from '@/contracts/api'

/**
 * Tentativa de pedido persistida por usuário: a mesma chave de idempotência é reutilizada
 * em cliques repetidos, retries após timeout e após refresh, até o pedido ficar terminal.
 */
export interface CheckoutAttempt {
  key: string
  body: CreateOrderRequest
  orderId?: string
}

const storageKey = (userId: string) => `kurio.checkout.${userId}`

export function getAttempt(userId: string): CheckoutAttempt | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as CheckoutAttempt) : null
  } catch {
    return null
  }
}

export function saveAttempt(userId: string, attempt: CheckoutAttempt): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(attempt))
}

export function clearAttempt(userId: string): void {
  localStorage.removeItem(storageKey(userId))
}

/** Reaproveita a tentativa quando o conteúdo é o mesmo; conteúdo novo gera nova chave. */
export function attemptFor(userId: string, body: CreateOrderRequest): CheckoutAttempt {
  const current = getAttempt(userId)
  if (current && JSON.stringify(current.body) === JSON.stringify(body)) return current
  const attempt = { key: crypto.randomUUID(), body }
  saveAttempt(userId, attempt)
  return attempt
}
