import { delay, HttpResponse } from 'msw'
import type { CreateOrderRequest, Network, Order } from '@/contracts/api'
import { db, nextId, save, type OrderRecord } from '../db'
import { networkFees } from '../fixtures'
import { EMAIL } from './auth'
import { fail, readJson, requireUser, route, shortHash } from '../http'
import { buildCart, findEdition } from '../pricing'
import { publishNft, publishOrder } from '../realtime'

const scheduled = new Set<string>()

function toOrder(record: OrderRecord): Order {
  const { userId: _u, idempotencyKey: _k, fingerprint: _f, settleAt: _s, ...order } = record
  return structuredClone(order)
}

/** Liquida o pagamento simulado. Confirmado e recusado são estados terminais. */
function settle(record: OrderRecord): void {
  scheduled.delete(record.id)
  if (record.status !== 'pending') return

  const shortage = record.lines.find((l) => (findEdition(l.nftId, l.editionId)?.edition.available ?? 0) < l.quantity)
  if (db.scenario.payment === 'declined' || shortage) {
    record.status = 'declined'
    record.declineReason = shortage ? 'Edição esgotada durante a confirmação.' : 'Pagamento recusado pela carteira.'
  } else {
    record.status = 'confirmed'
    const hash = Array.from({ length: 8 }, (_, i) => shortHash(`${record.id}:${i}`)).join('')
    record.transactionHash = `0x${hash}`
    record.explorerUrl = `https://etherscan.io/tx/0x${hash}`
    const cart = db.carts[`user:${record.userId}`] ?? []
    const touched = new Set<string>()
    for (const line of record.lines) {
      findEdition(line.nftId, line.editionId)!.edition.available -= line.quantity
      touched.add(line.nftId)
      // Remove do carrinho apenas a quantidade comprada.
      const item = cart.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
      if (item) item.quantity -= line.quantity
    }
    db.carts[`user:${record.userId}`] = cart.filter((i) => i.quantity > 0)
    touched.forEach((id) => publishNft(db.nfts.find((n) => n.id === id)!))
  }
  record.version += 1
  record.updatedAt = new Date().toISOString()
  save()
  publishOrder(toOrder(record), record.userId)
}

function schedule(record: OrderRecord): void {
  if (scheduled.has(record.id)) return
  scheduled.add(record.id)
  setTimeout(() => {
    const current = db.orders.find((o) => o.id === record.id)
    if (current) settle(current)
  }, Math.max(0, record.settleAt - Date.now()))
}

/** Retoma liquidações pendentes após refresh (o estado vem do storage). */
export function resumePendingOrders(): void {
  db.orders.filter((o) => o.status === 'pending').forEach(schedule)
}

function settleIfDue(record: OrderRecord): void {
  if (record.status === 'pending' && record.settleAt <= Date.now()) settle(record)
}

export const orderHandlers = [
  route('post', '/orders', async ({ request }) => {
    const user = requireUser(request)
    const key = request.headers.get('Idempotency-Key')
    if (!key) return fail(400, 'VALIDATION', 'Idempotency-Key é obrigatório.')
    const body = await readJson<CreateOrderRequest>(request)
    const fingerprint = shortHash(JSON.stringify(body))

    const existing = db.orders.find((o) => o.userId === user.id && o.idempotencyKey === key)
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        return fail(409, 'IDEMPOTENCY_CONFLICT', 'Esta tentativa de pedido já foi usada com outro conteúdo.')
      settleIfDue(existing)
      return HttpResponse.json(toOrder(existing))
    }

    const fields: Record<string, string> = {}
    const network = body.network as Network
    const wallet = body.walletSlot ? db.wallets[user.id]?.[body.walletSlot] : null
    if (!(network in networkFees)) fields.network = 'Selecione uma rede.'
    if (!wallet) fields.walletSlot = 'Selecione uma carteira cadastrada.'
    const connection = db.walletConnections[user.id]
    if (!body.collector?.displayName?.trim()) fields.displayName = 'Informe o nome de exibição.'
    if (!body.collector?.username?.trim()) fields.username = 'Informe o nome de usuário.'
    if (!EMAIL.test(body.collector?.email ?? '')) fields.email = 'Informe um e-mail válido.'
    if (Object.keys(fields).length) return fail(422, 'VALIDATION', 'Revise os dados do pagamento.', { fields })
    if (!connection || connection.slot !== body.walletSlot || connection.provider !== body.provider)
      return fail(409, 'WALLET_DISCONNECTED', 'Conecte a carteira selecionada antes de confirmar.')

    const { lines, quote } = buildCart(`user:${user.id}`, network)
    if (!lines.length) return fail(422, 'VALIDATION', 'O carrinho está vazio.')
    if (quote.issues.length)
      return fail(409, 'AVAILABILITY_CONFLICT', 'A disponibilidade de um ou mais itens mudou.', { quote })
    if (quote.id !== body.quoteId)
      return fail(409, 'QUOTE_CHANGED', 'Preços ou taxas mudaram. Revise e confirme novamente.', { quote })

    const now = new Date().toISOString()
    const record: OrderRecord = {
      id: nextId('ord'),
      status: 'pending',
      version: 1,
      createdAt: now,
      updatedAt: now,
      network,
      wallet: { type: connection.provider, address: wallet!.address },
      lines: lines.map(({ nftId, editionId, name, tokenId, image, editionLabel, quantity, unitPrice, lineTotal }) => ({
        nftId,
        editionId,
        name,
        tokenId,
        image,
        editionLabel,
        quantity,
        unitPrice,
        lineTotal,
      })),
      subtotal: quote.subtotal,
      discount: quote.discount,
      networkFee: quote.networkFee,
      total: quote.total,
      coupon: quote.coupon,
      transactionHash: null,
      explorerUrl: null,
      declineReason: null,
      userId: user.id,
      idempotencyKey: key,
      fingerprint,
      settleAt: Date.now() + db.scenario.paymentDelayMs,
    }
    db.orders.push(record)
    save()
    schedule(record)

    // Cenário de timeout: o pedido já existe, mas a resposta chega tarde demais.
    if (db.scenario.orderResponseDelayMs) await delay(db.scenario.orderResponseDelayMs)
    return HttpResponse.json(toOrder(record), { status: 201 })
  }),

  route('get', '/orders', ({ request }) => {
    const user = requireUser(request)
    const status = new URL(request.url).searchParams.get('status')
    const orders = db.orders.filter((o) => o.userId === user.id && (!status || o.status === status))
    orders.forEach(settleIfDue)
    return HttpResponse.json(orders.map(toOrder))
  }),

  route<{ id: string }>('get', '/orders/:id', ({ request, params }) => {
    const user = requireUser(request)
    // Pedido de outro usuário responde 404 para não revelar existência.
    const record = db.orders.find((o) => o.id === params.id && o.userId === user.id)
    if (!record) return fail(404, 'NOT_FOUND', 'Pedido não encontrado.')
    settleIfDue(record)
    return HttpResponse.json(toOrder(record))
  }),
]
