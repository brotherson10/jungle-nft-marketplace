import { HttpResponse } from 'msw'
import type { LoginRequest, RegisterRequest, Session } from '@/contracts/api'
import { db, nextId, save, type UserRecord } from '../db'
import { fail, readJson, requireUser, route, sha256, toUser } from '../http'

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const USERNAME = /^[a-z0-9_.]{3,20}$/i
export const PASSWORD_RULE = 'A senha precisa de 8+ caracteres, com letras e números.'
export const isStrongPassword = (p: string) => p.length >= 8 && /\d/.test(p) && /[a-z]/i.test(p)

function createSession(user: UserRecord): Session {
  const token = `tok_${crypto.randomUUID()}`
  const expiresAt = Date.now() + db.scenario.sessionTtlMs
  db.sessions.push({ token, userId: user.id, expiresAt })
  return { token, expiresAt: new Date(expiresAt).toISOString(), user: toUser(user) }
}

/** Itens do visitante são preservados ao autenticar, respeitando os limites da edição. */
function mergeGuestCart(request: Request, user: UserRecord): void {
  const guestKey = `guest:${request.headers.get('X-Guest-Id')}`
  const guestItems = db.carts[guestKey]
  if (!guestItems?.length) return
  const userKey = `user:${user.id}`
  const target = (db.carts[userKey] ??= [])
  for (const item of guestItems) {
    const existing = target.find((i) => i.nftId === item.nftId && i.editionId === item.editionId)
    if (existing) existing.quantity += item.quantity
    else target.push({ ...item })
  }
  for (const item of target) {
    const edition = db.nfts.find((n) => n.id === item.nftId)?.editions.find((e) => e.id === item.editionId)
    if (edition) item.quantity = Math.max(1, Math.min(item.quantity, edition.maxPerOrder))
  }
  db.cartCoupons[userKey] ??= db.cartCoupons[guestKey] ?? null
  delete db.carts[guestKey]
  delete db.cartCoupons[guestKey]
}

export const authHandlers = [
  route('post', '/auth/register', async ({ request }) => {
    const body = await readJson<RegisterRequest>(request)
    const username = body.username?.trim() ?? ''
    const email = body.email?.trim().toLowerCase() ?? ''
    const password = body.password ?? ''
    const fields: Record<string, string> = {}
    if (!USERNAME.test(username)) fields.username = 'Use 3 a 20 letras, números, "_" ou ".".'
    if (!EMAIL.test(email)) fields.email = 'Informe um e-mail válido.'
    if (!isStrongPassword(password)) fields.password = PASSWORD_RULE
    if (Object.keys(fields).length) return fail(422, 'VALIDATION', 'Revise os campos destacados.', { fields })

    if (db.users.some((u) => u.email === email)) fields.email = 'Este e-mail já está cadastrado.'
    if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
      fields.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(fields).length) return fail(409, 'CONFLICT', 'Conta já existente.', { fields })

    const salt = nextId('salt')
    const user: UserRecord = {
      id: nextId('u'),
      username,
      email,
      displayName: username,
      avatarUrl: null,
      bio: '',
      salt,
      passwordHash: await sha256(`${salt}:${password}`),
    }
    db.users.push(user)
    mergeGuestCart(request, user)
    const session = createSession(user)
    save()
    return HttpResponse.json(session, { status: 201 })
  }),

  route('post', '/auth/login', async ({ request }) => {
    const body = await readJson<LoginRequest>(request)
    const user = db.users.find((u) => u.email === body.email?.trim().toLowerCase())
    const valid = user && (await sha256(`${user.salt}:${body.password ?? ''}`)) === user.passwordHash
    if (!user || !valid) return fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    mergeGuestCart(request, user)
    const session = createSession(user)
    save()
    return HttpResponse.json(session)
  }),

  route('get', '/auth/session', ({ request }) => {
    const user = requireUser(request)
    const token = request.headers.get('Authorization')!.replace(/^Bearer /, '')
    const session = db.sessions.find((s) => s.token === token)!
    return HttpResponse.json({
      token,
      expiresAt: new Date(session.expiresAt).toISOString(),
      user: toUser(user),
    } satisfies Session)
  }),

  route('post', '/auth/logout', ({ request }) => {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '')
    db.sessions = db.sessions.filter((s) => s.token !== token)
    save()
    return new HttpResponse(null, { status: 204 })
  }),
]
