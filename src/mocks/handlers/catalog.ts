import { HttpResponse } from 'msw'
import type { Category, Facets, Network, Nft, NftListResponse, NftSort, NftSummary, NftTab } from '@/contracts/api'
import { cmpEth, isEth } from '@/lib/eth'
import { db, save } from '../db'
import { fail, requireUser, route } from '../http'

const toSummary = ({ id, name, tokenId, image, price, compareAtPrice, badge, category, network, version }: Nft): NftSummary => ({
  id,
  name,
  tokenId,
  image,
  price,
  compareAtPrice,
  badge,
  category,
  network,
  version,
})

const sorters: Record<NftSort, (a: Nft, b: Nft) => number> = {
  // Menor id = listado mais recentemente (os NFTs do layout abrem o catálogo).
  recent: (a, b) => a.id.localeCompare(b.id),
  'price-asc': (a, b) => cmpEth(a.price, b.price) || a.id.localeCompare(b.id),
  'price-desc': (a, b) => cmpEth(b.price, a.price) || a.id.localeCompare(b.id),
  popular: (a, b) => b.reviewCount - a.reviewCount || a.id.localeCompare(b.id),
}

function facetsOf(nfts: Nft[]): Facets {
  const categories = {} as Record<Category, number>
  const networks = {} as Record<Network, number>
  let min = nfts[0]?.price ?? '0'
  let max = nfts[0]?.price ?? '0'
  for (const n of nfts) {
    categories[n.category] = (categories[n.category] ?? 0) + 1
    networks[n.network] = (networks[n.network] ?? 0) + 1
    if (cmpEth(n.price, min) < 0) min = n.price
    if (cmpEth(n.price, max) > 0) max = n.price
  }
  return { categories, networks, priceRange: { min, max } }
}

export const catalogHandlers = [
  route('get', '/nfts', ({ request }) => {
    const params = new URL(request.url).searchParams
    const catalog = db.scenario.emptyCatalog ? [] : db.nfts
    const q = params.get('q')?.trim().toLowerCase()
    // Parâmetros repetidos, conforme NftListParams: ?categories=a&categories=b
    const categories = params.getAll('categories')
    const networks = params.getAll('networks')
    const minPrice = params.get('minPrice')
    const maxPrice = params.get('maxPrice')
    const collection = params.get('collection')
    const favoriteIds = params.get('favorites') === 'true' ? (db.favorites[requireUser(request).id] ?? []) : null
    const tab = (params.get('tab') ?? 'all') as NftTab
    const sort = (params.get('sort') ?? 'recent') as NftSort
    const page = Math.max(1, Number(params.get('page')) || 1)
    const pageSize = Math.min(48, Math.max(1, Number(params.get('pageSize')) || 9))

    if ((minPrice && !isEth(minPrice)) || (maxPrice && !isEth(maxPrice)) || !(sort in sorters))
      return fail(422, 'VALIDATION', 'Parâmetros de consulta inválidos.')

    let items = catalog.filter(
      (n) =>
        (!q || n.name.toLowerCase().includes(q) || n.collection.toLowerCase().includes(q)) &&
        (!collection || n.collection === collection) &&
        (!favoriteIds || favoriteIds.includes(n.id)) &&
        (!minPrice || cmpEth(n.price, minPrice) >= 0) &&
        (!maxPrice || cmpEth(n.price, maxPrice) <= 0),
    )
    // Facetas refletem busca e preço, antes dos filtros de categoria/rede.
    const facets = facetsOf(items)
    items = items.filter(
      (n) =>
        (!categories.length || categories.includes(n.category)) && (!networks.length || networks.includes(n.network)),
    )
    if (tab === 'new') items = items.filter((n) => Number(n.id.slice(4)) <= 12)
    if (tab === 'trending') items = items.filter((n) => n.reviewCount >= 20)
    items = [...items].sort(sorters[sort])

    const total = items.length
    const response: NftListResponse = {
      items: items.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      facets,
    }
    return HttpResponse.json(response)
  }),

  route('get', '/nfts/featured', () => {
    const featured = db.scenario.emptyCatalog ? [] : db.nfts.slice(0, 3)
    return HttpResponse.json(featured.map(toSummary))
  }),

  route<{ id: string }>('get', '/nfts/:id', ({ params }) => {
    const nft = db.nfts.find((n) => n.id === params.id)
    if (!nft) return fail(404, 'NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json(nft)
  }),

  route('get', '/favorites', ({ request }) => {
    const user = requireUser(request)
    return HttpResponse.json({ nftIds: db.favorites[user.id] ?? [] })
  }),

  route<{ id: string }>('put', '/favorites/:id', ({ request, params }) => {
    const user = requireUser(request)
    if (!db.nfts.some((n) => n.id === params.id)) return fail(404, 'NOT_FOUND', 'NFT não encontrado.')
    const list = (db.favorites[user.id] ??= [])
    if (!list.includes(params.id)) list.push(params.id)
    save()
    return HttpResponse.json({ nftIds: list })
  }),

  route<{ id: string }>('delete', '/favorites/:id', ({ request, params }) => {
    const user = requireUser(request)
    db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((id) => id !== params.id)
    save()
    return HttpResponse.json({ nftIds: db.favorites[user.id] })
  }),
]
