import { delay, http, HttpResponse, type PathParams } from 'msw'
import type { ApiErrorBody, ErrorCode, User } from '@/contracts/api'
import { db, save, type UserRecord } from './db'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'
type Resolver<P> = (info: { request: Request; params: P }) => Response | Promise<Response>

export function fail(status: number, code: ErrorCode, message: string, extra: Partial<ApiErrorBody> = {}): Response {
  return HttpResponse.json({ code, message, ...extra } satisfies ApiErrorBody, { status })
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export const shortHash = (text: string) => hash(text).toString(16).padStart(8, '0')

/** Latência e falhas do cenário ativo. Rotas de controle (/api/__mock) não são afetadas. */
async function applyScenario(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/__mock')) return

  const { latencyMs, failures } = db.scenario
  const ms = Array.isArray(latencyMs)
    ? latencyMs[0] + (hash(url.pathname + url.search) % Math.max(1, latencyMs[1] - latencyMs[0]))
    : latencyMs
  if (ms > 0) await delay(ms)

  const signature = `${request.method} ${url.pathname}`
  for (const [index, rule] of failures.entries()) {
    const matches = rule.route === '*' || signature === rule.route || (rule.route.endsWith('/*') && signature.startsWith(rule.route.slice(0, -1)))
    if (!matches) continue
    const key = `${index}:${rule.route}`
    const hits = db.failureHits[key] ?? 0
    if (rule.times !== undefined && hits >= rule.times) continue
    db.failureHits[key] = hits + 1
    save()
    if (rule.kind === 'network') return HttpResponse.error()
    if (rule.kind === 'timeout') await delay('infinite')
    const status = rule.kind === 'http-503' ? 503 : 500
    return fail(status, 'UNAVAILABLE', 'Serviço temporariamente indisponível. Tente novamente.')
  }
}

/** Declara um handler REST sob /api, com cenário aplicado e erros lançados como Response. */
export function route<P extends PathParams = PathParams>(method: Method, path: string, resolver: Resolver<P>) {
  return http[method](`/api${path}`, async ({ request, params }) => {
    const injected = await applyScenario(request)
    if (injected) return injected
    try {
      return await resolver({ request, params: params as P })
    } catch (error) {
      if (error instanceof Response) return error
      throw error
    }
  })
}

export function toUser({ id, username, email, displayName, avatarUrl }: UserRecord): User {
  return { id, username, email, displayName, avatarUrl }
}

export function findSession(token: string | null | undefined) {
  return token ? db.sessions.find((s) => s.token === token) : undefined
}

/** Usuário autenticado ou undefined (visitante). Sessão expirada gera 401. */
export function optionalUser(request: Request): UserRecord | undefined {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!token) return undefined
  const session = findSession(token)
  if (!session) throw fail(401, 'UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
  if (session.expiresAt <= Date.now()) throw fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  return db.users.find((u) => u.id === session.userId)
}

export function requireUser(request: Request): UserRecord {
  const user = optionalUser(request)
  if (!user) throw fail(401, 'UNAUTHENTICATED', 'Entre para continuar.')
  return user
}

/** Dono do carrinho: usuário autenticado ou visitante identificado por X-Guest-Id. */
export function cartOwner(request: Request): string {
  const user = optionalUser(request)
  if (user) return `user:${user.id}`
  const guest = request.headers.get('X-Guest-Id')
  if (!guest) throw fail(400, 'VALIDATION', 'Identificador de visitante ausente.')
  return `guest:${guest}`
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    const text = await request.text()
    return (text ? JSON.parse(text) : {}) as Partial<T>
  } catch {
    throw fail(400, 'VALIDATION', 'Corpo da requisição inválido.')
  }
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
