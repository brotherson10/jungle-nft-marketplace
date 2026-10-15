import type { Edition, Eth, Order } from './api'

/** Envelope comum: identidade estável, recurso afetado e versão monotônica do recurso. */
interface RealtimeEvent<TType extends string, TResource extends string, TData> {
  eventId: string
  type: TType
  resource: { type: TResource; id: string }
  version: number
  occurredAt: string
  data: TData
}

export type NftUpdatedEvent = RealtimeEvent<
  'nft.updated',
  'nft',
  { price: Eth; compareAtPrice: Eth | null; editions: Pick<Edition, 'id' | 'price' | 'available'>[] }
>

export type OrderUpdatedEvent = RealtimeEvent<'order.updated', 'order', Order>

export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
}
