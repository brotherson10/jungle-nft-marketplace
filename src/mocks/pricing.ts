import type { Cart, CartLine, Network, Quote } from '@/contracts/api'
import { addEth, bpsOf, cmpEth, mulEth, subEth } from '@/lib/eth'
import { db } from './db'
import { coupons, networkFees } from './fixtures'
import { fail, shortHash } from './http'

export function findEdition(nftId: string, editionId: string) {
  const nft = db.nfts.find((n) => n.id === nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  return nft && edition ? { nft, edition } : undefined
}

/** Valida um cupom; lança 422 para código inválido ou expirado. */
export function validateCoupon(code: string) {
  const coupon = coupons[code.trim().toUpperCase()]
  if (!coupon) throw fail(422, 'COUPON_INVALID', 'Cupom inválido.', { fields: { code: 'Cupom inválido.' } })
  if (coupon.expired) throw fail(422, 'COUPON_EXPIRED', 'Cupom expirado.', { fields: { code: 'Cupom expirado.' } })
  return coupon
}

/** Cotação calculada a partir do estado atual do catálogo; é a referência para o pedido. */
export function buildCart(owner: string, network: Network = 'ethereum'): Cart {
  const lines: CartLine[] = []
  for (const item of db.carts[owner] ?? []) {
    const found = findEdition(item.nftId, item.editionId)
    if (!found) continue
    const { nft, edition } = found
    lines.push({
      id: `${item.nftId}:${item.editionId}`,
      nftId: nft.id,
      editionId: edition.id,
      name: nft.name,
      tokenId: nft.tokenId,
      image: nft.image,
      editionLabel: edition.label,
      quantity: item.quantity,
      unitPrice: edition.price,
      previousUnitPrice: item.acceptedPrice,
      lineTotal: mulEth(edition.price, item.quantity),
      available: edition.available,
      maxPerOrder: edition.maxPerOrder,
      nftVersion: nft.version,
    })
  }

  const subtotal = addEth('0', ...lines.map((l) => l.lineTotal))
  const code = db.cartCoupons[owner] ?? null
  const coupon = code ? coupons[code] : undefined
  let discount = '0'
  if (coupon && !coupon.expired) {
    discount = coupon.bps ? bpsOf(subtotal, coupon.bps) : (coupon.fixed ?? '0')
    if (cmpEth(discount, subtotal) > 0) discount = subtotal
  }
  const networkFee = lines.length ? networkFees[network] : '0'
  const total = addEth(subEth(subtotal, discount), networkFee)

  const issues: Quote['issues'] = lines
    .filter((l) => l.quantity > l.available)
    .map((l) => ({ lineId: l.id, code: l.available === 0 ? 'UNAVAILABLE' : 'INSUFFICIENT', available: l.available }))

  const quoteLines = lines.map(({ id, nftId, editionId, quantity, unitPrice, lineTotal }) => ({
    id,
    nftId,
    editionId,
    quantity,
    unitPrice,
    lineTotal,
  }))
  const canonical = JSON.stringify([network, code, quoteLines, discount, networkFee, issues])

  return {
    lines,
    quote: {
      id: `q_${shortHash(canonical)}`,
      network,
      subtotal,
      discount,
      networkFee,
      total,
      coupon: coupon && code ? { code, label: coupon.label } : null,
      lines: quoteLines,
      issues,
    },
  }
}
