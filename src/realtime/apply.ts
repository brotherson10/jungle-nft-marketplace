import type { QueryClient } from '@tanstack/react-query'
import type { Cart, Nft, NftListResponse } from '@/contracts/api'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/contracts/events'
import { keys } from '@/api/queries'

export interface RealtimeNotices {
  /** Um NFT presente no carrinho mudou de preço ou disponibilidade. */
  onCartItemChanged?: (name: string) => void
}

/**
 * Aplicação idempotente de eventos no cache: duplicatas (mesmo eventId) e eventos
 * com versão menor ou igual à conhecida são ignorados, sem regredir estado.
 */
export function createEventApplier(queryClient: QueryClient, userId: string | null, notices: RealtimeNotices = {}) {
  const seen = new Set<string>()
  const versions = new Map<string, number>()

  function accept(event: NftUpdatedEvent | OrderUpdatedEvent): boolean {
    const resourceKey = `${event.resource.type}:${event.resource.id}`
    if (seen.has(event.eventId) || (versions.get(resourceKey) ?? 0) >= event.version) return false
    seen.add(event.eventId)
    versions.set(resourceKey, event.version)
    return true
  }

  function nftUpdated(event: NftUpdatedEvent): boolean {
    if (!accept(event)) return false
    const { id } = event.resource
    const { price, compareAtPrice, editions } = event.data

    queryClient.setQueryData<Nft>(keys.nftDetail(id), (nft) =>
      nft && nft.version < event.version
        ? {
            ...nft,
            price,
            compareAtPrice,
            version: event.version,
            editions: nft.editions.map((e) => ({ ...e, ...editions.find((u) => u.id === e.id) })),
          }
        : nft,
    )
    queryClient.setQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] }, (page) =>
      page && {
        ...page,
        items: page.items.map((n) =>
          n.id === id && n.version < event.version ? { ...n, price, compareAtPrice, version: event.version } : n,
        ),
      },
    )
    const inCart = queryClient
      .getQueriesData<Cart>({ queryKey: ['cart'] })
      .flatMap(([, cart]) => cart?.lines ?? [])
      .find((line) => line.nftId === id)
    if (inCart) notices.onCartItemChanged?.(inCart.name)
    // Carrinho e cotação são recalculados pela API.
    void queryClient.invalidateQueries({ queryKey: ['cart'] })
    return true
  }

  function orderUpdated(event: OrderUpdatedEvent): boolean {
    // Defesa extra: um evento privado nunca atualiza o cache de outro usuário.
    if (!userId || !accept(event)) return false
    queryClient.setQueryData(keys.order(userId, event.resource.id), (order: OrderUpdatedEvent['data'] | undefined) =>
      !order || order.version < event.version ? event.data : order,
    )
    void queryClient.invalidateQueries({ queryKey: keys.pendingOrders(userId) })
    if (event.data.status === 'confirmed') void queryClient.invalidateQueries({ queryKey: ['cart'] })
    return true
  }

  return { nftUpdated, orderUpdated }
}
