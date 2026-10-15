import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import { findSession } from './http'
import { register } from './realtime'

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const host = new URL(import.meta.env.VITE_SOCKET_URL).host

/**
 * Conexões Socket.IO (transporte WebSocket) para o host configurado.
 * O MSW remove o prefixo "/socket.io/" da URL antes de casar o handler, por isso só o host.
 */
const realtime = ws.link(new RegExp(`^wss?://${escape(host)}(/|$)`))

// O binding anuncia pingInterval 25s/pingTimeout 5s mas não envia pings;
// sem o heartbeat o socket.io-client encerraria a conexão por "ping timeout".
const PING_INTERVAL_MS = 25_000
const ENGINE_IO_PING = '2'

export const socketHandlers = [
  realtime.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    // Identidade da conexão vem do token na query do handshake.
    const session = findSession(new URL(connection.client.url).searchParams.get('token'))
    const userId = session && session.expiresAt > Date.now() ? session.userId : null

    const unregister = register({
      deliver: ({ event, userId: target }) => {
        // Eventos privados só chegam à conexão do próprio usuário.
        if (target === null || target === userId) io.client.emit(event.type, event)
      },
      close: () => connection.client.close(),
    })
    const heartbeat = setInterval(() => connection.client.send(ENGINE_IO_PING), PING_INTERVAL_MS)
    connection.client.addEventListener('close', () => {
      clearInterval(heartbeat)
      unregister()
    })
  }),
]
