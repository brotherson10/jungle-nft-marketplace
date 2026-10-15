/** Cenários determinísticos e configuráveis da camada de mocks. */
export type FailureKind = 'network' | 'http-500' | 'http-503' | 'timeout'

export interface Failure {
  /** "METHOD /path" exato, "METHOD /path/*" por prefixo, ou "*" para qualquer requisição. */
  route: string
  kind: FailureKind
  /** Quantas vezes falhar antes de voltar ao normal (padrão: sempre). */
  times?: number
}

export interface Scenario {
  /** Latência fixa ou faixa [min, max] distribuída de forma determinística por URL. */
  latencyMs: number | [number, number]
  failures: Failure[]
  payment: 'confirmed' | 'declined'
  paymentDelayMs: number
  /** Atraso da resposta da criação de pedido (após persistir), para simular timeout. */
  orderResponseDelayMs: number
  emptyCatalog: boolean
  walletConnection: 'approve' | 'reject'
  sessionTtlMs: number
}

const base: Scenario = {
  latencyMs: 250,
  failures: [],
  payment: 'confirmed',
  paymentDelayMs: 2500,
  orderResponseDelayMs: 0,
  walletConnection: 'approve',
  emptyCatalog: false,
  sessionTtlMs: 60 * 60 * 1000,
}

export const scenarioPresets = {
  default: {},
  fast: { latencyMs: 0, paymentDelayMs: 300 },
  slow: { latencyMs: 2500 },
  'variable-latency': { latencyMs: [50, 1800] },
  'empty-catalog': { emptyCatalog: true },
  // 3 falhas: esgota os 2 retries automáticos e exige a nova tentativa manual.
  'catalog-error': { failures: [{ route: 'GET /api/nfts', kind: 'http-500', times: 3 }] },
  offline: { failures: [{ route: '*', kind: 'network' }] },
  'favorite-error': { failures: [{ route: 'PUT /api/favorites/*', kind: 'http-503', times: 1 }] },
  'payment-declined': { payment: 'declined' },
  'order-timeout': { orderResponseDelayMs: 15000 },
  'wallet-rejected': { walletConnection: 'reject' },
  'short-session': { sessionTtlMs: 60 * 1000 },
} satisfies Record<string, Partial<Scenario>>

export type ScenarioName = keyof typeof scenarioPresets

export function resolveScenario(name: string, overrides: Partial<Scenario> = {}): Scenario {
  const preset: Partial<Scenario> = scenarioPresets[name as ScenarioName] ?? {}
  return { ...base, ...preset, ...overrides }
}

export function isScenarioName(name: string): name is ScenarioName {
  return name in scenarioPresets
}
