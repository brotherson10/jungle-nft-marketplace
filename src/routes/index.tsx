import { createFileRoute } from '@tanstack/react-router'
import type { NftListParams, NftSort, NftTab } from '@/contracts/api'
import { CatalogHome } from '@/components/catalog/catalog-home'
import { isEth } from '@/lib/eth'
import { categories, networks } from '@/lib/labels'

const TABS: NftTab[] = ['all', 'new', 'trending']
const SORTS: NftSort[] = ['recent', 'price-asc', 'price-desc', 'popular']

const list = <T extends string>(value: unknown, allowed: T[]): T[] | undefined => {
  const values = (Array.isArray(value) ? value : [value]).filter((v): v is T => allowed.includes(v as T))
  return values.length ? values : undefined
}
const oneOf = <T extends string>(value: unknown, allowed: T[]) => (allowed.includes(value as T) ? (value as T) : undefined)
const eth = (value: unknown) => {
  const text = typeof value === 'number' ? String(value) : value
  return typeof text === 'string' && isEth(text) ? text : undefined
}

/** Busca, filtros, ordenação e página vivem na URL (refresh e histórico). */
export function validateCatalogSearch(search: Record<string, unknown>): NftListParams {
  return {
    q: typeof search.q === 'string' && search.q.trim() ? search.q.trim() : undefined,
    categories: list(search.categories, categories),
    networks: list(search.networks, networks),
    minPrice: eth(search.minPrice),
    maxPrice: eth(search.maxPrice),
    favorites: search.favorites === true || search.favorites === 'true' ? true : undefined,
    tab: oneOf(search.tab, TABS),
    sort: oneOf(search.sort, SORTS),
    page: Number.isInteger(search.page) && (search.page as number) > 1 ? (search.page as number) : undefined,
  }
}

export const Route = createFileRoute('/')({
  validateSearch: validateCatalogSearch,
  component: HomePage,
})

function HomePage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return <CatalogHome search={search} onSearch={(patch) => void navigate({ search: (prev) => ({ ...prev, ...patch }) })} />
}
