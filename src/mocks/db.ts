import type { Eth, Nft, Order, Profile, WalletConnection, Wallets } from '@/contracts/api'
import { buildCatalog, seedUsers } from './fixtures'
import { resolveScenario, type Scenario } from './scenarios'

export interface UserRecord extends Profile {
  salt: string
  passwordHash: string
}

export interface CartItemRecord {
  nftId: string
  editionId: string
  quantity: number
  /** Último preço visto/aceito pelo usuário para esta linha. */
  acceptedPrice: Eth
}

export interface OrderRecord extends Order {
  userId: string
  idempotencyKey: string
  fingerprint: string
  settleAt: number
}

export interface DbState {
  seq: number
  scenarioName: string
  scenario: Scenario
  /** Contador de falhas já consumidas por regra de cenário. */
  failureHits: Record<string, number>
  users: UserRecord[]
  sessions: { token: string; userId: string; expiresAt: number }[]
  nfts: Nft[]
  favorites: Record<string, string[]>
  /** Chave: "user:<id>" ou "guest:<id>". */
  carts: Record<string, CartItemRecord[]>
  cartCoupons: Record<string, string | null>
  wallets: Record<string, Wallets>
  orders: OrderRecord[]
  walletConnections: Record<string, WalletConnection | null>
}

const STORAGE_KEY = 'kurio.mock.db.v2'

export function seed(scenarioName = 'default', overrides: Partial<Scenario> = {}): DbState {
  return {
    seq: 1000,
    scenarioName,
    scenario: resolveScenario(scenarioName, overrides),
    failureHits: {},
    users: structuredClone(seedUsers) as UserRecord[],
    sessions: [],
    nfts: buildCatalog(),
    favorites: {},
    carts: {},
    cartCoupons: {},
    wallets: {
      'u-ana': {
        primary: {
          slot: 'primary',
          displayName: 'Ana Colecionadora',
          nickname: 'Principal',
          network: 'ethereum',
          profileName: 'ana.kurio',
          address: '0xA91F00000000000000000000000000000000E82C',
          secondaryAddress: '',
          type: 'metamask',
          referralCode: 'KURIO-ANA',
          email: 'ana@kurio.test',
          ensName: 'ana',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        secondary: null,
      },
    },
    orders: [],
    walletConnections: {},
  }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DbState
  } catch {
    // Estado corrompido ou storage indisponível: volta ao seed.
  }
  return seed()
}

export let db: DbState = load()

// Outra aba alterou o estado simulado: adota a versão persistida.
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) db = event.newValue ? (JSON.parse(event.newValue) as DbState) : seed()
})

export function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Sem persistência disponível; o estado segue em memória.
  }
}

export function reset(scenarioName?: string, overrides?: Partial<Scenario>): void {
  db = seed(scenarioName ?? db.scenarioName, overrides)
  save()
}

export function nextId(prefix: string): string {
  db.seq += 1
  return `${prefix}-${db.seq}`
}
