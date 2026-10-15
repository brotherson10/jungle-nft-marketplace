import { HttpResponse } from 'msw'
import type { AddCartItemRequest, Network } from '@/contracts/api'
import { db, save } from '../db'
import { networkFees } from '../fixtures'
import { cartOwner, fail, readJson, route } from '../http'
import { buildCart, findEdition, validateCoupon } from '../pricing'

function respond(request: Request, owner: string) {
  const network = new URL(request.url).searchParams.get('network') as Network | null
  return HttpResponse.json(buildCart(owner, network && network in networkFees ? network : undefined))
}

function checkQuantity(quantity: unknown, available: number, maxPerOrder: number): number {
  if (!Number.isInteger(quantity) || (quantity as number) < 1)
    throw fail(422, 'VALIDATION', 'Quantidade inválida.', { fields: { quantity: 'Informe um número inteiro maior que zero.' } })
  const limit = Math.min(available, maxPerOrder)
  if ((quantity as number) > limit)
    throw fail(409, 'AVAILABILITY_CONFLICT', `Disponível: até ${limit} unidade(s) desta edição.`, {
      fields: { quantity: `Máximo de ${limit}.` },
    })
  return quantity as number
}

export const cartHandlers = [
  route('get', '/cart', ({ request }) => respond(request, cartOwner(request))),

  route('post', '/cart/items', async ({ request }) => {
    const owner = cartOwner(request)
    const body = await readJson<AddCartItemRequest>(request)
    const found = findEdition(body.nftId ?? '', body.editionId ?? '')
    if (!found) return fail(404, 'NOT_FOUND', 'Edição não encontrada.')
    const items = (db.carts[owner] ??= [])
    const existing = items.find((i) => i.nftId === body.nftId && i.editionId === body.editionId)
    const quantity = checkQuantity(
      (existing?.quantity ?? 0) + (body.quantity ?? 0),
      found.edition.available,
      found.edition.maxPerOrder,
    )
    if (existing) Object.assign(existing, { quantity, acceptedPrice: found.edition.price })
    else items.push({ nftId: found.nft.id, editionId: found.edition.id, quantity, acceptedPrice: found.edition.price })
    save()
    return respond(request, owner)
  }),

  route<{ lineId: string }>('patch', '/cart/items/:lineId', async ({ request, params }) => {
    const owner = cartOwner(request)
    const item = db.carts[owner]?.find((i) => `${i.nftId}:${i.editionId}` === params.lineId)
    const found = item && findEdition(item.nftId, item.editionId)
    if (!item || !found) return fail(404, 'NOT_FOUND', 'Item não está no carrinho.')
    const body = await readJson<{ quantity: number }>(request)
    item.quantity = checkQuantity(body.quantity, found.edition.available, found.edition.maxPerOrder)
    item.acceptedPrice = found.edition.price
    save()
    return respond(request, owner)
  }),

  route<{ lineId: string }>('delete', '/cart/items/:lineId', ({ request, params }) => {
    const owner = cartOwner(request)
    db.carts[owner] = (db.carts[owner] ?? []).filter((i) => `${i.nftId}:${i.editionId}` !== params.lineId)
    save()
    return respond(request, owner)
  }),

  /** Usuário reconhece os preços atuais após uma alteração. */
  route('post', '/cart/accept-prices', ({ request }) => {
    const owner = cartOwner(request)
    for (const item of db.carts[owner] ?? []) {
      const found = findEdition(item.nftId, item.editionId)
      if (found) item.acceptedPrice = found.edition.price
    }
    save()
    return respond(request, owner)
  }),

  route('put', '/cart/coupon', async ({ request }) => {
    const owner = cartOwner(request)
    const { code = '' } = await readJson<{ code: string }>(request)
    validateCoupon(code)
    db.cartCoupons[owner] = code.trim().toUpperCase()
    save()
    return respond(request, owner)
  }),

  route('delete', '/cart/coupon', ({ request }) => {
    const owner = cartOwner(request)
    db.cartCoupons[owner] = null
    save()
    return respond(request, owner)
  }),
]
