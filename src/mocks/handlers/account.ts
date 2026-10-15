import { HttpResponse } from 'msw'
import type {
  ChangePasswordRequest,
  Profile,
  UpdateProfileRequest,
  Wallet,
  WalletConnection,
  WalletInput,
  WalletType,
  WalletSlot,
  Wallets,
} from '@/contracts/api'
import { db, save, type UserRecord } from '../db'
import { networkFees } from '../fixtures'
import { EMAIL, isStrongPassword, PASSWORD_RULE, USERNAME } from './auth'
import { fail, readJson, requireUser, route, sha256 } from '../http'

const toProfile = ({ id, username, email, displayName, avatarUrl, bio }: UserRecord): Profile => ({
  id,
  username,
  email,
  displayName,
  avatarUrl,
  bio,
})

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const WALLET_TYPES = ['metamask', 'walletconnect', 'coinbase']
const MAX_AVATAR_BYTES = 512 * 1024

export const accountHandlers = [
  route('get', '/profile', ({ request }) => HttpResponse.json(toProfile(requireUser(request)))),

  route('patch', '/profile', async ({ request }) => {
    const user = requireUser(request)
    const body = await readJson<UpdateProfileRequest>(request)
    const next = {
      displayName: body.displayName?.trim() ?? '',
      username: body.username?.trim() ?? '',
      email: body.email?.trim().toLowerCase() ?? '',
      bio: body.bio?.trim() ?? '',
    }
    const fields: Record<string, string> = {}
    if (next.displayName.length < 2) fields.displayName = 'Informe o nome de exibição.'
    if (!USERNAME.test(next.username)) fields.username = 'Use 3 a 20 letras, números, "_" ou ".".'
    if (!EMAIL.test(next.email)) fields.email = 'Informe um e-mail válido.'
    if (next.bio.length > 280) fields.bio = 'Máximo de 280 caracteres.'
    if (Object.keys(fields).length) return fail(422, 'VALIDATION', 'Revise os campos destacados.', { fields })
    if (db.users.some((u) => u.id !== user.id && u.email === next.email)) fields.email = 'E-mail já cadastrado.'
    if (db.users.some((u) => u.id !== user.id && u.username.toLowerCase() === next.username.toLowerCase()))
      fields.username = 'Nome de usuário em uso.'
    if (Object.keys(fields).length) return fail(409, 'CONFLICT', 'Dados já usados por outra conta.', { fields })
    Object.assign(user, next)
    save()
    return HttpResponse.json(toProfile(user))
  }),

  /** Avatar enviado como data URL (PNG/JPEG/WebP até 512 KB). */
  route('put', '/profile/avatar', async ({ request }) => {
    const user = requireUser(request)
    const { dataUrl = '' } = await readJson<{ dataUrl: string }>(request)
    const match = /^data:image\/(png|jpeg|webp);base64,/.exec(dataUrl)
    const bytes = Math.ceil(((dataUrl.length - (match?.[0].length ?? 0)) * 3) / 4)
    if (!match) return fail(422, 'VALIDATION', 'Envie uma imagem PNG, JPEG ou WebP.', { fields: { avatar: 'Formato inválido.' } })
    if (bytes > MAX_AVATAR_BYTES) return fail(422, 'VALIDATION', 'Imagem acima de 512 KB.', { fields: { avatar: 'Máximo de 512 KB.' } })
    user.avatarUrl = dataUrl
    save()
    return HttpResponse.json(toProfile(user))
  }),

  route('delete', '/profile/avatar', ({ request }) => {
    const user = requireUser(request)
    user.avatarUrl = null
    save()
    return HttpResponse.json(toProfile(user))
  }),

  route('post', '/profile/password', async ({ request }) => {
    const user = requireUser(request)
    const body = await readJson<ChangePasswordRequest>(request)
    if ((await sha256(`${user.salt}:${body.currentPassword ?? ''}`)) !== user.passwordHash)
      return fail(422, 'VALIDATION', 'Senha atual incorreta.', { fields: { currentPassword: 'Senha atual incorreta.' } })
    if (!isStrongPassword(body.newPassword ?? ''))
      return fail(422, 'VALIDATION', PASSWORD_RULE, { fields: { newPassword: PASSWORD_RULE } })
    user.passwordHash = await sha256(`${user.salt}:${body.newPassword}`)
    save()
    return new HttpResponse(null, { status: 204 })
  }),

  route('get', '/wallets', ({ request }) => {
    const user = requireUser(request)
    return HttpResponse.json(db.wallets[user.id] ?? ({ primary: null, secondary: null } satisfies Wallets))
  }),

  /** Conexão simulada: aprovada ou recusada conforme o cenário. */
  route('post', '/wallets/connect', async ({ request }) => {
    const user = requireUser(request)
    const { slot, provider } = await readJson<{ slot: WalletSlot; provider: WalletType }>(request)
    const wallet = slot ? db.wallets[user.id]?.[slot] : null
    if (!wallet) return fail(404, 'NOT_FOUND', 'Cadastre esta carteira antes de conectar.')
    if (!WALLET_TYPES.includes(provider ?? '')) return fail(422, 'VALIDATION', 'Selecione um provedor de carteira.')
    if (db.scenario.walletConnection === 'reject') {
      db.walletConnections[user.id] = null
      save()
      return fail(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
    }
    const connection: WalletConnection = { slot: slot!, provider: provider!, address: wallet.address, connectedAt: new Date().toISOString() }
    db.walletConnections[user.id] = connection
    save()
    return HttpResponse.json(connection)
  }),

  route('get', '/wallets/connection', ({ request }) => {
    const user = requireUser(request)
    return HttpResponse.json(db.walletConnections[user.id] ?? null)
  }),

  route('delete', '/wallets/connection', ({ request }) => {
    const user = requireUser(request)
    db.walletConnections[user.id] = null
    save()
    return new HttpResponse(null, { status: 204 })
  }),

  route<{ slot: string }>('put', '/wallets/:slot', async ({ request, params }) => {
    const user = requireUser(request)
    const slot = params.slot as WalletSlot
    if (slot !== 'primary' && slot !== 'secondary') return fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
    const body = await readJson<WalletInput>(request)
    const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    const input: WalletInput = {
      displayName: text(body.displayName),
      nickname: text(body.nickname),
      network: body.network!,
      profileName: text(body.profileName),
      address: text(body.address),
      secondaryAddress: text(body.secondaryAddress),
      type: body.type!,
      referralCode: text(body.referralCode),
      email: text(body.email).toLowerCase(),
      ensName: text(body.ensName).toLowerCase(),
    }
    const fields: Record<string, string> = {}
    if (!input.displayName) fields.displayName = 'Obrigatório.'
    if (!input.nickname) fields.nickname = 'Obrigatório.'
    if (!(input.network in networkFees)) fields.network = 'Selecione uma rede.'
    if (!input.profileName) fields.profileName = 'Obrigatório.'
    if (!ADDRESS.test(input.address)) fields.address = 'Endereço 0x com 40 caracteres hexadecimais.'
    if (input.secondaryAddress && !ADDRESS.test(input.secondaryAddress) && !input.secondaryAddress.endsWith('.eth'))
      fields.secondaryAddress = 'Use um endereço 0x ou nome ENS.'
    if (!WALLET_TYPES.includes(input.type)) fields.type = 'Selecione uma carteira.'
    if (!input.referralCode) fields.referralCode = 'Obrigatório.'
    if (!EMAIL.test(input.email)) fields.email = 'Informe um e-mail válido.'
    if (!/^[a-z0-9-]{3,}$/.test(input.ensName)) fields.ensName = 'Mínimo de 3 letras, números ou "-".'
    if (Object.keys(fields).length) return fail(422, 'VALIDATION', 'Revise os dados da carteira.', { fields })

    const wallets = (db.wallets[user.id] ??= { primary: null, secondary: null })
    const wallet: Wallet = { ...input, slot, updatedAt: new Date().toISOString() }
    wallets[slot] = wallet
    save()
    return HttpResponse.json(wallets)
  }),
]
