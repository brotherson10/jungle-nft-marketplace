import type { Nft, Order } from '@/contracts/api'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/contracts/events'
import { nextId, save } from './db'

type AnyEvent = NftUpdatedEvent | OrderUpdatedEvent
/** userId null = evento público (catálogo). */
export type Delivery = { event: AnyEvent; userId: string | null }

interface Connection {
  deliver: (delivery: Delivery) => void
  close: () => void
}

const connections = new Set<Connection>()
const log: Delivery[] = []

export function register(connection: Connection): () => void {
  connections.add(connection)
  return () => connections.delete(connection)
}

function publish(delivery: Delivery): void {
  log.push(delivery)
  if (log.length > 50) log.shift()
  save()
  connections.forEach((c) => c.deliver(delivery))
}

/** Incrementa a versão do NFT e publica o evento com o estado já persistido. */
export function publishNft(nft: Nft): void {
  nft.version += 1
  publish({
    userId: null,
    event: {
      eventId: nextId('evt'),
      type: 'nft.updated',
      resource: { type: 'nft', id: nft.id },
      version: nft.version,
      occurredAt: new Date().toISOString(),
      data: {
        price: nft.price,
        compareAtPrice: nft.compareAtPrice,
        editions: nft.editions.map(({ id, price, available }) => ({ id, price, available })),
      },
    },
  })
}

export function publishOrder(order: Order, userId: string): void {
  publish({
    userId,
    event: {
      eventId: nextId('evt'),
      type: 'order.updated',
      resource: { type: 'order', id: order.id },
      version: order.version,
      occurredAt: new Date().toISOString(),
      data: structuredClone(order),
    },
  })
}

/** Reenvia os últimos eventos (duplicatas/antigos) para cenários de teste. */
export function replay(count = 1): number {
  const items = log.slice(-count)
  items.forEach((delivery) => connections.forEach((c) => c.deliver(delivery)))
  return items.length
}

/** Derruba as conexões abertas; o socket.io-client reconecta sozinho. */
export function dropConnections(): number {
  const count = connections.size
  connections.forEach((c) => c.close())
  return count
}
