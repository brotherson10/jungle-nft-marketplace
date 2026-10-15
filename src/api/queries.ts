import { keepPreviousData, QueryClient, queryOptions } from '@tanstack/react-query'
import type { Network, NftListParams } from '@/contracts/api'
import { ApiError } from './client'
import { accountApi, authApi, cartApi, favoritesApi, nftApi, orderApi } from './endpoints'

/**
 * Chaves: dados públicos em ["nfts", ...]; dados privados sempre sob ["user", userId, ...]
 * para isolamento por usuário e limpeza total no logout/troca de usuário.
 */
export const keys = {
  nftList: (params: NftListParams) => ['nfts', 'list', params] as const,
  nftFeatured: () => ['nfts', 'featured'] as const,
  nftDetail: (id: string) => ['nfts', 'detail', id] as const,
  session: (token: string) => ['session', token] as const,
  cart: (owner: string, network?: Network) => ['cart', owner, network ?? 'ethereum'] as const,
  user: (userId: string) => ['user', userId] as const,
  favorites: (userId: string) => ['user', userId, 'favorites'] as const,
  profile: (userId: string) => ['user', userId, 'profile'] as const,
  wallets: (userId: string) => ['user', userId, 'wallets'] as const,
  walletConnection: (userId: string) => ['user', userId, 'wallet-connection'] as const,
  order: (userId: string, id: string) => ['user', userId, 'orders', id] as const,
  pendingOrders: (userId: string) => ['user', userId, 'orders', 'pending'] as const,
}

export const queries = {
  nftList: (params: NftListParams) =>
    queryOptions({
      queryKey: keys.nftList(params),
      queryFn: ({ signal }) => nftApi.list(params, { signal }),
      placeholderData: keepPreviousData,
    }),
  nftFeatured: () => queryOptions({ queryKey: keys.nftFeatured(), queryFn: ({ signal }) => nftApi.featured({ signal }) }),
  nftDetail: (id: string) =>
    queryOptions({ queryKey: keys.nftDetail(id), queryFn: ({ signal }) => nftApi.detail(id, { signal }) }),
  session: (token: string) =>
    queryOptions({ queryKey: keys.session(token), queryFn: ({ signal }) => authApi.session({ signal }), staleTime: 60_000 }),
  cart: (owner: string, network?: Network) =>
    queryOptions({ queryKey: keys.cart(owner, network), queryFn: ({ signal }) => cartApi.get(network, { signal }), staleTime: 0 }),
  favorites: (userId: string) =>
    queryOptions({ queryKey: keys.favorites(userId), queryFn: ({ signal }) => favoritesApi.list({ signal }) }),
  profile: (userId: string) =>
    queryOptions({ queryKey: keys.profile(userId), queryFn: ({ signal }) => accountApi.profile({ signal }) }),
  wallets: (userId: string) =>
    queryOptions({ queryKey: keys.wallets(userId), queryFn: ({ signal }) => accountApi.wallets({ signal }) }),
  walletConnection: (userId: string) =>
    queryOptions({ queryKey: keys.walletConnection(userId), queryFn: ({ signal }) => accountApi.connection({ signal }) }),
  order: (userId: string, id: string) =>
    queryOptions({ queryKey: keys.order(userId, id), queryFn: ({ signal }) => orderApi.get(id, { signal }) }),
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Só repete falhas transitórias (rede, timeout, 5xx); 4xx são definitivos.
        retry: (count, error) => error instanceof ApiError && error.transient && count < 2,
      },
      mutations: { retry: false },
    },
  })
}
