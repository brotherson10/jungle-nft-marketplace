/** Valor em ETH como string decimal (ex.: "1.19"). Nunca trafega como number. */
export type Eth = string

export type Network = 'ethereum' | 'polygon' | 'solana'
export type WalletType = 'metamask' | 'walletconnect' | 'coinbase'
export type Category =
  | 'arte-digital'
  | 'fotografia'
  | 'musica'
  | 'arte-3d'
  | 'colecionaveis'
  | 'generativa'
  | 'jogos'
  | 'assinaturas'
  | 'utilidade'

export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'AVAILABILITY_CONFLICT'
  | 'QUOTE_CHANGED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'UNAVAILABLE'
  | 'WALLET_REJECTED'
  | 'WALLET_DISCONNECTED'

export interface ApiErrorBody {
  code: ErrorCode
  message: string
  /** Erros por campo (validação ou conflito). */
  fields?: Record<string, string>
  /** Cotação atual quando code = QUOTE_CHANGED. */
  quote?: Quote
}

// ---- Sessão e conta ----

export interface User {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl: string | null
}

export interface Session {
  token: string
  expiresAt: string
  user: User
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

// ---- NFTs ----

export interface Edition {
  id: string
  /** Rótulo exibido: "1/1", "1/10", "1/50", "ABERTA". */
  label: string
  price: Eth
  available: number
  maxPerOrder: number
}

export interface NftSummary {
  id: string
  name: string
  tokenId: string
  image: string
  price: Eth
  compareAtPrice: Eth | null
  badge: 'raro' | null
  category: Category
  network: Network
  version: number
}

export interface Nft extends NftSummary {
  description: string
  details: string
  collection: string
  creator: string
  attributes: string[]
  images: string[]
  editions: Edition[]
  rating: number
  reviewCount: number
  contractAddress: string
  royaltyBps: number
}

export type NftTab = 'all' | 'new' | 'trending'
export type NftSort = 'recent' | 'price-asc' | 'price-desc' | 'popular'

export interface NftListParams {
  q?: string
  categories?: Category[]
  networks?: Network[]
  minPrice?: Eth
  maxPrice?: Eth
  collection?: string
  /** Apenas favoritos do usuário autenticado. */
  favorites?: boolean
  tab?: NftTab
  sort?: NftSort
  page?: number
  pageSize?: number
}

export interface Facets {
  categories: Record<Category, number>
  networks: Record<Network, number>
  priceRange: { min: Eth; max: Eth }
}

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface NftListResponse extends Page<NftSummary> {
  facets: Facets
}

// ---- Favoritos ----

export interface Favorites {
  nftIds: string[]
}

// ---- Carrinho e cotação ----

export interface CartLine {
  id: string
  nftId: string
  editionId: string
  name: string
  tokenId: string
  image: string
  editionLabel: string
  quantity: number
  unitPrice: Eth
  /** Preço quando o item foi adicionado/confirmado pelo usuário. */
  previousUnitPrice: Eth
  lineTotal: Eth
  available: number
  maxPerOrder: number
  nftVersion: number
}

export interface Quote {
  id: string
  network: Network
  subtotal: Eth
  discount: Eth
  networkFee: Eth
  total: Eth
  coupon: { code: string; label: string } | null
  lines: Pick<CartLine, 'id' | 'nftId' | 'editionId' | 'quantity' | 'unitPrice' | 'lineTotal'>[]
  /** Problemas que impedem finalizar (ex.: quantidade acima do disponível). */
  issues: { lineId: string; code: 'UNAVAILABLE' | 'INSUFFICIENT'; available: number }[]
}

export interface Cart {
  lines: CartLine[]
  quote: Quote
}

export interface AddCartItemRequest {
  nftId: string
  editionId: string
  quantity: number
}

// ---- Perfil e carteiras ----

export interface Profile extends User {
  bio: string
}

export interface UpdateProfileRequest {
  displayName: string
  username: string
  email: string
  bio: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export type WalletSlot = 'primary' | 'secondary'

export interface Wallet {
  slot: WalletSlot
  displayName: string
  nickname: string
  network: Network
  profileName: string
  address: string
  secondaryAddress: string
  type: WalletType
  referralCode: string
  email: string
  ensName: string
  updatedAt: string
}

export type WalletInput = Omit<Wallet, 'slot' | 'updatedAt'>

/** Conexão simulada de uma carteira cadastrada com um provedor. */
export interface WalletConnection {
  slot: WalletSlot
  provider: WalletType
  address: string
  connectedAt: string
}

export interface Wallets {
  primary: Wallet | null
  secondary: Wallet | null
}

// ---- Pedidos ----

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface CreateOrderRequest {
  quoteId: string
  walletSlot: WalletSlot
  provider: WalletType
  network: Network
  collector: {
    displayName: string
    username: string
    email: string
  }
  note: string
}

export interface OrderLine {
  nftId: string
  editionId: string
  name: string
  tokenId: string
  image: string
  editionLabel: string
  quantity: number
  unitPrice: Eth
  lineTotal: Eth
}

export interface Order {
  id: string
  status: OrderStatus
  version: number
  createdAt: string
  updatedAt: string
  network: Network
  wallet: { type: WalletType; address: string }
  /** Snapshot imutável da cotação no momento da criação. */
  lines: OrderLine[]
  subtotal: Eth
  discount: Eth
  networkFee: Eth
  total: Eth
  coupon: { code: string; label: string } | null
  transactionHash: string | null
  explorerUrl: string | null
  declineReason: string | null
}
