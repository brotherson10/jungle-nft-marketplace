import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Mail, Search, ShoppingCart, Star } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Nft } from '@/contracts/api'
import { ApiError } from '@/api/client'
import { queries } from '@/api/queries'
import { QuantityStepper } from '@/components/cart/quantity-stepper'
import { QueryError } from '@/components/feedback/query-error'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageTitle } from '@/components/layout/page-title'
import { FavoriteButton } from '@/components/nft/favorite-button'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCartMutations } from '@/hooks/use-cart'
import { formatEth } from '@/lib/eth'
import { networkLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/nft/$nftId')({
  loader: ({ context, params }) => context.queryClient.prefetchQuery(queries.nftDetail(params.nftId)),
  component: NftDetailPage,
})

function NftDetailPage() {
  const { nftId } = Route.useParams()
  const detail = useQuery(queries.nftDetail(nftId))

  if (detail.isPending) return <DetailSkeleton />
  if (detail.error instanceof ApiError && detail.error.code === 'NOT_FOUND')
    return (
      <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-24">
        <h1 className="text-2xl font-bold">NFT não encontrado</h1>
        <p className="text-muted-foreground">Este NFT não existe ou foi removido do catálogo.</p>
        <Link to="/" className="font-semibold text-primary underline">
          Voltar ao catálogo
        </Link>
      </main>
    )
  if (!detail.data)
    return (
      <main className="mx-auto max-w-[1200px] px-6 py-12">
        <QueryError error={detail.error} onRetry={() => void detail.refetch()} title="Não foi possível carregar este NFT." />
      </main>
    )
  return <NftDetail key={detail.data.id} nft={detail.data} />
}

function NftDetail({ nft }: { nft: Nft }) {
  const navigate = useNavigate()
  const { add } = useCartMutations()
  const defaultEdition = nft.editions.find((e) => e.label === '1/50' && e.available > 0) ?? nft.editions.find((e) => e.available > 0)
  const [editionId, setEditionId] = useState(defaultEdition?.id ?? nft.editions[0]!.id)
  const [image, setImage] = useState(0)
  const [requested, setRequested] = useState(1)
  const edition = nft.editions.find((e) => e.id === editionId)!
  const limit = Math.min(edition.available, edition.maxPerOrder)
  // Disponibilidade pode cair em tempo real: a quantidade se ajusta ao novo limite.
  const quantity = Math.max(1, Math.min(requested, limit))
  const share = encodeURIComponent(window.location.href)

  const buy = () =>
    add.mutate(
      { nftId: nft.id, editionId, quantity },
      {
        onSuccess: () => {
          toast.success(`${nft.name} adicionado ao carrinho.`)
          void navigate({ to: '/carrinho' })
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Não foi possível adicionar ao carrinho.'),
      },
    )

  return (
    <main className="mx-auto max-w-[1200px] px-4 md:px-6">
      <PageTitle action={<FavoriteButton nftId={nft.id} nftName={nft.name} className="size-10 rounded-full border-none bg-card" />} />
      <Breadcrumb current={nft.name} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col-reverse gap-4 md:flex-row">
          <div className="flex gap-3 md:flex-col" role="group" aria-label="Galeria">
            {nft.images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setImage(i)}
                aria-label={`Imagem ${i + 1} de ${nft.images.length}`}
                aria-pressed={i === image}
                className={cn('overflow-hidden rounded-sm border-2 border-transparent', i === image && 'border-primary')}
              >
                <img src={src} alt="" width={88} height={88} className="size-16 object-cover md:size-[88px]" />
              </button>
            ))}
          </div>
          <div className="relative flex-1 rounded-sm bg-card p-4">
            <img src={nft.images[image]} alt={nft.name} width={400} height={400} fetchPriority="high" className="aspect-square w-full rounded-2xl object-cover" />
            <Dialog>
              <DialogTrigger asChild>
                <button type="button" aria-label="Ampliar imagem" className="absolute top-6 right-6 grid size-9 place-items-center rounded-full bg-background/80">
                  <Search className="size-5" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogTitle>{nft.name}</DialogTitle>
                <DialogDescription className="sr-only">Imagem ampliada</DialogDescription>
                <img src={nft.images[image]} alt={nft.name} className="w-full rounded-lg" />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-t-3xl bg-card p-5 md:rounded-none md:bg-transparent md:p-0">
          <h1 className="text-2xl font-bold md:text-3xl">{nft.name}</h1>
          <div className="flex flex-wrap items-center justify-between gap-3 border-border pb-3 md:border-b">
            <p className="text-2xl font-bold text-primary" data-testid="nft-price" aria-live="polite">
              {formatEth(edition.price)}
            </p>
            <p className="flex items-center gap-2 text-sm">
              <span className="flex" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={cn('size-4', i < nft.rating ? 'fill-foreground' : 'opacity-40')} />
                ))}
              </span>
              <span>
                <span className="sr-only">Nota {nft.rating} de 5, </span>
                {nft.reviewCount} avaliações de colecionadores
              </span>
            </p>
          </div>
          <h2 className="font-bold">Sobre este NFT:</h2>
          <p className="text-sm text-muted-foreground">{nft.description}</p>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-bold">Edição:</legend>
            <div className="flex flex-wrap gap-2">
              {nft.editions.map((e) => (
                <label
                  key={e.id}
                  className={cn(
                    'cursor-pointer rounded-full border border-border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                    e.available === 0 && 'cursor-not-allowed line-through opacity-50',
                  )}
                >
                  <input type="radio" name="edition" value={e.id} checked={e.id === editionId} disabled={e.available === 0} onChange={() => setEditionId(e.id)} className="sr-only" />
                  {e.label}
                  {e.available === 0 && <span className="sr-only"> (esgotada)</span>}
                </label>
              ))}
            </div>
            <p className="text-sm text-muted-foreground" data-testid="edition-availability" aria-live="polite">
              {edition.available > 0 ? `${edition.available} disponíveis · até ${edition.maxPerOrder} por pedido` : 'Edição indisponível'}
            </p>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <QuantityStepper value={quantity} max={limit} onChange={setRequested} label="Quantidade" disabled={limit === 0} />
            <div className="flex gap-3">
              <Button size="lg" onClick={buy} disabled={limit === 0 || add.isPending} className="min-w-36">
                <ShoppingCart aria-hidden="true" className="md:hidden" />
                {add.isPending ? 'Adicionando…' : 'COMPRAR'}
              </Button>
              <FavoriteButton nftId={nft.id} nftName={nft.name} withLabel className="hidden h-12 px-4 md:inline-flex" />
            </div>
          </div>

          <dl className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div>
              <dt className="inline">ID do token: </dt>
              <dd className="inline">{nft.tokenId}</dd>
            </div>
            <div>
              <dt className="inline">Coleção: </dt>
              <dd className="inline">{nft.collection}</dd>
            </div>
            <div>
              <dt className="inline">Atributos: </dt>
              <dd className="inline">{nft.attributes.join(', ')}</dd>
            </div>
          </dl>
          <div className="flex items-center gap-3 text-sm font-bold">
            Compartilhar este NFT:
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${share}`} target="_blank" rel="noreferrer noopener" aria-label="Compartilhar no LinkedIn (abre em nova aba)">
              in
            </a>
            <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${share}`} aria-label="Compartilhar por e-mail">
              <Mail className="size-4" />
            </a>
            <a href={`https://x.com/intent/post?url=${share}`} target="_blank" rel="noreferrer noopener" aria-label="Compartilhar no X (abre em nova aba)">
              X
            </a>
          </div>
        </div>
      </div>

      <Tabs defaultValue="details" className="mt-12">
        <TabsList variant="line" className="h-auto w-full justify-start border-b border-border">
          <TabsTrigger value="details" className="whitespace-normal">
            Detalhes do NFT
          </TabsTrigger>
          <TabsTrigger value="reviews" className="whitespace-normal">
            Avaliações de colecionadores ({nft.reviewCount})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="flex flex-col gap-4 pt-4 text-sm text-muted-foreground">
          <p>{nft.details}</p>
          <p>
            <strong className="block text-foreground">Rede:</strong> Cunhado na {networkLabels[nft.network]} com procedência imutável e metadados armazenados no IPFS.
          </p>
          <p>
            <strong className="block text-foreground">Direitos autorais:</strong> {nft.creator} recebe {nft.royaltyBps / 100}% nas vendas secundárias.
          </p>
          <p>
            <strong className="block text-foreground">Contrato:</strong> {nft.contractAddress.slice(0, 6)}…{nft.contractAddress.slice(-4)} · Contrato inteligente ERC-721 verificado.
          </p>
        </TabsContent>
        <TabsContent value="reviews" className="pt-4 text-sm text-muted-foreground">
          Nota média {nft.rating} de 5 com base em {nft.reviewCount} avaliações de colecionadores.
        </TabsContent>
      </Tabs>

      <MoreFromCollection nft={nft} />
    </main>
  )
}

function MoreFromCollection({ nft }: { nft: Nft }) {
  const { data, isPending } = useQuery(queries.nftList({ collection: nft.collection, pageSize: 6 }))
  const items = data?.items.filter((n) => n.id !== nft.id).slice(0, 5)
  return (
    <section aria-labelledby="more-title" className="mt-16">
      <h2 id="more-title" className="border-b border-border pb-3 font-bold text-primary">
        Mais desta coleção
      </h2>
      <ul className="mt-6 flex snap-x gap-6 overflow-x-auto pb-4">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-44 shrink-0 md:w-52">
                <NftCardSkeleton />
              </li>
            ))
          : items?.map((item) => (
              <li key={item.id} className="w-44 shrink-0 snap-start md:w-52">
                <NftCard nft={item} />
              </li>
            ))}
      </ul>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-6" aria-busy="true" aria-label="Carregando NFT">
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </main>
  )
}
