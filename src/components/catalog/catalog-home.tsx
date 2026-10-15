import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react'
import { useId, useState } from 'react'
import type { NftListParams, NftSort, NftTab } from '@/contracts/api'
import { queries } from '@/api/queries'
import { QueryError } from '@/components/feedback/query-error'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { sortLabels, tabLabels } from '@/lib/labels'
import { notAvailable } from '@/lib/out-of-scope'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'
import { CatalogFilters } from './catalog-filters'
import { Pagination } from './pagination'

const PAGE_SIZE = 9

const articles = [
  ['12 de setembro', 6, 'Como funciona a propriedade de NFTs', 'Aprenda a colecionar, negociar e verificar ativos digitais.', '/images/nfts/ivory.webp'],
  ['13 de setembro', 2, '10 artistas digitais para acompanhar', 'Conheça criadores que moldam a cultura digital.', '/images/nfts/emerald.webp'],
  ['15 de setembro', 3, 'Raridade, atributos e procedência', 'Entenda raridade, procedência, direitos autorais e utilidade.', '/images/nfts/sage.webp'],
  ['15 de setembro', 2, 'Como proteger sua carteira', 'Proteja sua carteira, seus ativos e sua identidade.', '/images/nfts/golden.webp'],
] as const

export function CatalogHome({ search, onSearch }: { search: NftListParams; onSearch: (patch: Partial<NftListParams>) => void }) {
  const session = useSession()
  const params = { ...search, pageSize: PAGE_SIZE }
  const favoritesWithoutSession = search.favorites && !session
  const list = useQuery({ ...queries.nftList(params), enabled: !favoritesWithoutSession })
  const featured = useQuery(queries.nftFeatured())
  const [slide, setSlide] = useState(0)
  const [term, setTerm] = useState(search.q ?? '')
  const searchId = useId()
  // Mudança de filtro reinicia a paginação.
  const change = (patch: Partial<NftListParams>) => onSearch({ ...patch, page: undefined })
  const hero = featured.data?.[slide]
  const filterCount = (search.categories?.length ?? 0) + (search.networks?.length ?? 0) + (search.minPrice || search.maxPrice ? 1 : 0)

  return (
    <main className="mx-auto max-w-[1200px] px-4 md:px-6">
      <form
        role="search"
        className="flex gap-3 pt-4 lg:hidden"
        onSubmit={(e) => {
          e.preventDefault()
          change({ q: term.trim() || undefined })
        }}
      >
        <label htmlFor={searchId} className="sr-only">
          Explorar coleções
        </label>
        <div className="relative flex-1">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input id={searchId} type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Explorar coleções" className="h-11 rounded-xl bg-card pl-10" />
        </div>
        <MobileFilters search={search} facets={list.data?.facets} onChange={change} count={filterCount} />
      </form>

      <section aria-labelledby="hero-title" className="relative mt-4 grid grid-cols-[1fr_auto] items-center gap-4 overflow-hidden rounded-3xl bg-card p-4 md:mt-0 md:gap-6 md:rounded-none md:bg-transparent md:px-6 md:py-14">
        <div className="flex flex-col gap-4">
          <p className="text-xs md:text-sm">Bem-vindo à Kurio</p>
          {/* Textos do Figma: frame mobile e frame desktop. */}
          <h1 id="hero-title" className="text-lg leading-snug font-bold md:text-4xl md:leading-[1.6]">
            <span className="md:hidden">SEJA DONO DA CULTURA DIGITAL</span>
            <span className="hidden md:inline">
              SEJA DONO DO FUTURO <br />
              DA ARTE DIGITAL
            </span>
          </h1>
          <p className="max-w-md text-xs text-muted-foreground md:text-sm">
            <span className="md:hidden">Descubra NFTs selecionados de criadores do mundo todo.</span>
            <span className="hidden md:inline">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
            </span>
          </p>
          <a href="#catalogo" className="w-fit rounded-sm bg-primary px-5 py-2 text-sm font-bold text-primary-foreground max-md:bg-transparent max-md:p-0 max-md:text-primary">
            EXPLORAR <ArrowRight aria-hidden="true" className="inline size-4 md:hidden" />
          </a>
        </div>
        <div className="flex flex-col items-center gap-3">
          {hero ? (
            <Link to="/nft/$nftId" params={{ nftId: hero.id }} aria-label={`Destaque: ${hero.name}`}>
              <img src={hero.image} alt={hero.name} width={420} height={420} fetchPriority="high" className="aspect-square w-32 rounded-2xl object-cover sm:w-40 md:w-[420px]" />
            </Link>
          ) : (
            <Skeleton className="aspect-square w-32 rounded-2xl sm:w-40 md:w-[420px]" />
          )}
          <div className="flex" role="group" aria-label="Destaques">
            {featured.data?.map((nft, i) => (
              <button
                key={nft.id}
                type="button"
                aria-label={`Mostrar destaque ${i + 1}: ${nft.name}`}
                aria-pressed={i === slide}
                onClick={() => setSlide(i)}
                // Alvo de toque de 24px com o ponto visual do layout no centro.
                className="group grid size-6 place-items-center"
              >
                <span className={cn('size-2.5 rounded-full bg-primary/40', i === slide && 'bg-primary')} />
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="catalogo" aria-labelledby="catalog-title" className="mt-6 grid scroll-mt-4 gap-8 lg:mt-12 lg:grid-cols-[310px_1fr]">
        <h2 id="catalog-title" className="sr-only">
          Catálogo de NFTs
        </h2>
        <aside className="hidden flex-col gap-10 lg:flex" aria-label="Filtros">
          <div className="rounded-sm bg-card p-5">
            <CatalogFilters key={`${search.minPrice}-${search.maxPrice}`} search={search} facets={list.data?.facets} onChange={change} />
          </div>
          {featured.data?.[1] && (
            <Link to="/nft/$nftId" params={{ nftId: featured.data[1].id }} className="flex flex-col gap-2 rounded-sm bg-card pt-4">
              <span className="px-4 text-xl font-bold text-primary">NFT EM DESTAQUE</span>
              <span className="text-center text-lg font-bold">OFERTA LIMITADA</span>
              <img src={featured.data[1].image} alt={featured.data[1].name} width={310} height={310} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
            </Link>
          )}
        </aside>

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div role="group" aria-label="Seleção do catálogo" className="flex gap-4 overflow-x-auto text-sm">
              {(Object.keys(tabLabels) as NftTab[]).map((tab) => {
                const active = (search.tab ?? 'all') === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={active}
                    onClick={() => change({ tab: tab === 'all' ? undefined : tab })}
                    className={cn('shrink-0 border-b-2 border-transparent pb-1', active && 'border-primary font-semibold text-primary')}
                  >
                    {tabLabels[tab]}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span id="sort-label">Ordenar por:</span>
              <Select value={search.sort ?? 'recent'} onValueChange={(value) => change({ sort: value === 'recent' ? undefined : (value as NftSort) })}>
                <SelectTrigger aria-labelledby="sort-label" className="w-52 border-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(sortLabels) as NftSort[]).map((sort) => (
                    <SelectItem key={sort} value={sort}>
                      {sortLabels[sort]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(search.q || search.favorites) && (
            <p className="text-sm text-muted-foreground">
              {search.favorites ? 'Exibindo seus favoritos' : `Resultados para “${search.q}”`}{' '}
              <button type="button" className="text-primary underline" onClick={() => change({ q: undefined, favorites: undefined })}>
                Limpar
              </button>
            </p>
          )}

          {favoritesWithoutSession ? (
            <p className="rounded-lg bg-card p-6">
              <Link to="/entrar" search={{ redirect: '/?favorites=true' }} className="font-semibold text-primary underline">
                Entre
              </Link>{' '}
              para ver seus favoritos.
            </p>
          ) : list.isError && !list.data ? (
            <QueryError error={list.error} onRetry={() => void list.refetch()} title="Não foi possível carregar o catálogo." />
          ) : (
            <>
              <p className="sr-only" aria-live="polite">
                {list.data ? `${list.data.total} NFTs encontrados` : 'Carregando NFTs'}
              </p>
              {list.isPlaceholderData && <p className="text-xs text-muted-foreground">Atualizando resultados…</p>}
              {list.data?.items.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-lg bg-card p-6">
                  <p className="font-semibold">Nenhum NFT encontrado.</p>
                  <p className="text-sm text-muted-foreground">Ajuste a busca ou os filtros para ver mais resultados.</p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      change({ q: undefined, categories: undefined, networks: undefined, minPrice: undefined, maxPrice: undefined, favorites: undefined, tab: undefined })
                    }
                  >
                    Limpar filtros
                  </Button>
                </div>
              ) : (
                <ul aria-busy={list.isFetching} className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6" data-testid="catalog-grid">
                  {list.data
                    ? list.data.items.map((nft, i) => (
                        <li key={nft.id}>
                          <NftCard nft={nft} eager={i < 3} />
                        </li>
                      ))
                    : Array.from({ length: PAGE_SIZE }, (_, i) => (
                        <li key={i}>
                          <NftCardSkeleton />
                        </li>
                      ))}
                </ul>
              )}
              {list.data && <Pagination page={list.data.page} totalPages={list.data.totalPages} onPage={(page) => onSearch({ page: page > 1 ? page : undefined })} />}
            </>
          )}
        </div>
      </section>

      <section aria-label="Coleções em destaque" className="mt-20 hidden gap-8 md:grid md:grid-cols-2">
        {[
          { title: 'Lançamentos gênesis de edição limitada', text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.', image: '/images/nfts/emerald.webp', search: { tab: 'new' as const } },
          { title: 'Arte digital selecionada e muito mais', text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a rede.', image: '/images/nfts/ivory.webp', search: { categories: ['arte-digital' as const] } },
        ].map((promo) => (
          <article key={promo.title} className="grid grid-cols-2 items-center overflow-hidden rounded-sm bg-card">
            <img src={promo.image} alt="" width={290} height={250} loading="lazy" className="h-full w-full object-cover" />
            <div className="flex flex-col items-end gap-3 p-4 text-right">
              <h3 className="font-bold">{promo.title}</h3>
              <p className="text-xs text-muted-foreground">{promo.text}</p>
              <Link to="/" search={promo.search} hash="catalogo" className="rounded-sm bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">
                Explorar <span className="sr-only">{promo.title}</span> →
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="journal-title" className="mt-20 hidden md:block">
        <h2 id="journal-title" className="text-center text-2xl font-bold">
          Diário da Cunhagem
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
        <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {articles.map(([date, minutes, title, text, image]) => (
            <li key={title} className="overflow-hidden rounded-sm bg-card">
              <img src={image} alt="" width={290} height={170} loading="lazy" className="aspect-[290/170] w-full object-cover" />
              <div className="flex flex-col gap-2 p-4">
                <p className="text-xs text-muted-foreground">
                  {date} | Leitura de {minutes} min
                </p>
                <h3 className="font-bold">{title}</h3>
                <p className="text-xs text-muted-foreground">{text}</p>
                <button type="button" className="w-fit text-xs text-primary" onClick={() => notAvailable('O conteúdo editorial')}>
                  Ler mais <span className="sr-only">sobre {title}</span> →
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

function MobileFilters({ search, facets, onChange, count }: Parameters<typeof CatalogFilters>[0] & { count: number }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" size="icon" className="size-11 rounded-xl lg:hidden" aria-label={`Filtros${count ? ` (${count} ativos)` : ''}`}>
          <SlidersHorizontal />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-6">
        <SheetHeader className="p-0">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Combine coleções, faixa de preço e rede.</SheetDescription>
        </SheetHeader>
        <CatalogFilters key={`${search.minPrice}-${search.maxPrice}`} search={search} facets={facets} onChange={onChange} />
      </SheetContent>
    </Sheet>
  )
}
