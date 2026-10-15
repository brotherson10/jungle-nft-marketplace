import type {
  AddCartItemRequest,
  Cart,
  ChangePasswordRequest,
  CreateOrderRequest,
  Favorites,
  LoginRequest,
  Network,
  Nft,
  NftListParams,
  NftListResponse,
  NftSummary,
  Order,
  Profile,
  RegisterRequest,
  Session,
  UpdateProfileRequest,
  WalletConnection,
  WalletInput,
  WalletType,
  Wallets,
  WalletSlot,
} from '@/contracts/api'
import { http } from './client'

type Opts = { signal?: AbortSignal }

export const authApi = {
  login: (body: LoginRequest) => http.post<Session>('/auth/login', body).then((r) => r.data),
  register: (body: RegisterRequest) => http.post<Session>('/auth/register', body).then((r) => r.data),
  session: ({ signal }: Opts = {}) => http.get<Session>('/auth/session', { signal }).then((r) => r.data),
  logout: () => http.post('/auth/logout').then(() => undefined),
}

export const nftApi = {
  list: (params: NftListParams, { signal }: Opts = {}) =>
    http.get<NftListResponse>('/nfts', { params, signal }).then((r) => r.data),
  featured: ({ signal }: Opts = {}) => http.get<NftSummary[]>('/nfts/featured', { signal }).then((r) => r.data),
  detail: (id: string, { signal }: Opts = {}) => http.get<Nft>(`/nfts/${id}`, { signal }).then((r) => r.data),
}

export const favoritesApi = {
  list: ({ signal }: Opts = {}) => http.get<Favorites>('/favorites', { signal }).then((r) => r.data),
  add: (nftId: string) => http.put<Favorites>(`/favorites/${nftId}`).then((r) => r.data),
  remove: (nftId: string) => http.delete<Favorites>(`/favorites/${nftId}`).then((r) => r.data),
}

export const cartApi = {
  get: (network: Network | undefined, { signal }: Opts = {}) =>
    http.get<Cart>('/cart', { params: { network }, signal }).then((r) => r.data),
  add: (body: AddCartItemRequest) => http.post<Cart>('/cart/items', body).then((r) => r.data),
  update: (lineId: string, quantity: number) =>
    http.patch<Cart>(`/cart/items/${encodeURIComponent(lineId)}`, { quantity }).then((r) => r.data),
  remove: (lineId: string) => http.delete<Cart>(`/cart/items/${encodeURIComponent(lineId)}`).then((r) => r.data),
  acceptPrices: () => http.post<Cart>('/cart/accept-prices').then((r) => r.data),
  applyCoupon: (code: string) => http.put<Cart>('/cart/coupon', { code }).then((r) => r.data),
  removeCoupon: () => http.delete<Cart>('/cart/coupon').then((r) => r.data),
}

export const orderApi = {
  /** A mesma chave deve ser reutilizada em todas as tentativas do mesmo pedido. */
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    http
      .post<Order>('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey }, timeout: 8_000 })
      .then((r) => r.data),
  get: (id: string, { signal }: Opts = {}) => http.get<Order>(`/orders/${id}`, { signal }).then((r) => r.data),
  pending: ({ signal }: Opts = {}) =>
    http.get<Order[]>('/orders', { params: { status: 'pending' }, signal }).then((r) => r.data),
}

export const accountApi = {
  profile: ({ signal }: Opts = {}) => http.get<Profile>('/profile', { signal }).then((r) => r.data),
  updateProfile: (body: UpdateProfileRequest) => http.patch<Profile>('/profile', body).then((r) => r.data),
  updateAvatar: (dataUrl: string) => http.put<Profile>('/profile/avatar', { dataUrl }).then((r) => r.data),
  removeAvatar: () => http.delete<Profile>('/profile/avatar').then((r) => r.data),
  changePassword: (body: ChangePasswordRequest) => http.post('/profile/password', body).then(() => undefined),
  wallets: ({ signal }: Opts = {}) => http.get<Wallets>('/wallets', { signal }).then((r) => r.data),
  saveWallet: (slot: WalletSlot, body: WalletInput) => http.put<Wallets>(`/wallets/${slot}`, body).then((r) => r.data),
  connection: ({ signal }: Opts = {}) =>
    http.get<WalletConnection | null>('/wallets/connection', { signal }).then((r) => r.data),
  connect: (slot: WalletSlot, provider: WalletType) =>
    http.post<WalletConnection>('/wallets/connect', { slot, provider }).then((r) => r.data),
  disconnect: () => http.delete('/wallets/connection').then(() => undefined),
}
