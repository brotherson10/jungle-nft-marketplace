import type { QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { Socket } from 'socket.io-client'
import type { ServerToClientEvents } from '@/contracts/events'
import { createEventApplier, type RealtimeNotices } from './apply'

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

let status: RealtimeStatus = 'connecting'
const listeners = new Set<() => void>()
function setStatus(next: RealtimeStatus) {
  status = next
  listeners.forEach((l) => l())
}

export const useRealtimeStatus = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )

/**
 * Abre uma conexão Socket.IO para a sessão atual. Cada sessão tem seu próprio socket;
 * o retorno encerra conexão e listeners (logout/troca de usuário/desmontagem).
 */
export function connectRealtime(
  queryClient: QueryClient,
  auth: { token: string; userId: string } | null,
  notices: RealtimeNotices = {},
): () => void {
  const apply = createEventApplier(queryClient, auth?.userId ?? null, notices)
  let socket: Socket<ServerToClientEvents> | null = null
  let disposed = false
  setStatus('connecting')

  // Import sob demanda: o engine.io-client só é avaliado depois que o MSW instalou o
  // interceptor de WebSocket (ver main.tsx), e não pesa no carregamento inicial.
  void import('socket.io-client').then(({ io }) => {
    if (disposed) return
    socket = io(import.meta.env.VITE_SOCKET_URL, {
      // Somente WebSocket: o MSW intercepta WebSocket, não o long-polling HTTP do Engine.IO.
      transports: ['websocket'],
      query: auth ? { token: auth.token } : {},
    })
    let connectedBefore = false
    socket.on('connect', () => {
      setStatus('connected')
      // Reconexão: eventos podem ter sido perdidos; reconcilia os recursos ativos via REST.
      if (connectedBefore) void queryClient.invalidateQueries({ type: 'active' })
      connectedBefore = true
    })
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('connect_error', () => setStatus('disconnected'))
    socket.on('nft.updated', apply.nftUpdated)
    socket.on('order.updated', apply.orderUpdated)
  })

  return () => {
    disposed = true
    socket?.removeAllListeners()
    socket?.disconnect()
  }
}
