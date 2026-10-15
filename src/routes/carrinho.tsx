import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Cart, CartLine } from '@/contracts/api'
import { ApiError } from '@/api/client'
import { queries } from '@/api/queries'
import { CouponForm } from '@/components/cart/coupon-form'
import { OrderSummary, OrderSummarySkeleton } from '@/components/cart/order-summary'
import { QuantityStepper } from '@/components/cart/quantity-stepper'
import { QueryError } from '@/components/feedback/query-error'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageTitle } from '@/components/layout/page-title'
import { NftCard } from '@/components/nft/nft-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart, useCartMutations } from '@/hooks/use-cart'
import { changedLines } from '@/lib/cart'
import { cmpEth, formatEth } from '@/lib/eth'
import { useSession } from '@/lib/session'

export const Route = createFileRoute('/carrinho')({ component: CartPage })

function CartPage() {
  const cart = useCart()
  const session = useSession()
  const navigate = useNavigate()
  const { acceptPrices } = useCartMutations()
  const data = cart.data
  const changed = data ? changedLines(data) : []
  const blocked = !data?.lines.length || !!data.quote.issues.length || changed.length > 0

  return (
    <main className="mx-auto max-w-[1200px] px-4 md:px-6">
      <PageTitle>Carrinho de NFTs</PageTitle>
      <Breadcrumb current="Carrinho" />
      {/* No mobile o título visível vem do PageTitle. */}
      <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>

      {cart.isError && !data ? (
        <QueryError error={cart.error} onRetry={() => void cart.refetch()} title="Não foi possível carregar o carrinho." />
      ) : data && data.lines.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-lg bg-card p-8">
          <p className="text-lg font-semibold">Seu carrinho está vazio.</p>
          <Link to="/" className="font-semibold text-primary underline">
            Explorar NFTs
          </Link>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_332px] lg:gap-20">
          <section aria-labelledby="cart-items-title">
            <h2 id="cart-items-title" className="sr-only">
              Itens
            </h2>
            {changed.length > 0 && (
              <div role="alert" className="mb-4 flex flex-col gap-3 rounded-lg border border-primary bg-band p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p>O preço de {changed.length === 1 ? 'um item mudou' : `${changed.length} itens mudou`}. Revise os novos valores antes de finalizar.</p>
                <Button size="sm" onClick={() => acceptPrices.mutate()} disabled={acceptPrices.isPending}>
                  Aceitar novos preços
                </Button>
              </div>
            )}
            <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_40px] border-b border-border pb-3 text-sm font-semibold md:grid" aria-hidden="true">
              <span>NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
            </div>
            <ul className="mt-3 flex flex-col gap-3" aria-busy={cart.isFetching} data-testid="cart-lines">
              {data
                ? data.lines.map((line) => <CartLineItem key={line.id} line={line} issue={data.quote.issues.find((i) => i.lineId === line.id)} />)
                : [0, 1, 2].map((i) => (
                    <li key={i}>
                      <Skeleton className="h-[110px] w-full md:h-[70px]" />
                    </li>
                  ))}
            </ul>
          </section>

          <aside aria-labelledby="summary-title" className="flex flex-col gap-5 rounded-t-3xl bg-card p-5 lg:rounded-none lg:bg-transparent lg:p-0">
            <h2 id="summary-title" className="hidden border-b border-border pb-3 text-lg font-bold lg:block">
              Resumo da carteira
            </h2>
            {data ? <CouponForm coupon={data.quote.coupon} /> : <Skeleton className="h-16 w-full" />}
            <div aria-live="polite">{data ? <OrderSummary quote={data.quote} /> : <OrderSummarySkeleton />}</div>
            <Button
              size="lg"
              disabled={blocked}
              onClick={() => void navigate(session ? { to: '/pagamento' } : { to: '/entrar', search: { redirect: '/pagamento' } })}
            >
              Conectar e finalizar
            </Button>
            {data && data.quote.issues.length > 0 && <p className="text-sm text-destructive">Ajuste as quantidades indisponíveis para continuar.</p>}
            <Link to="/" className="text-center text-primary">
              Continuar explorando
            </Link>
          </aside>
        </div>
      )}
      <AlsoViewed />
    </main>
  )
}

function CartLineItem({ line, issue }: { line: CartLine; issue?: Cart['quote']['issues'][number] }) {
  const { update, remove } = useCartMutations()
  const onError = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Não foi possível atualizar o carrinho.')
  const priceChanged = cmpEth(line.unitPrice, line.previousUnitPrice) !== 0
  const limit = Math.max(line.quantity, Math.min(line.available, line.maxPerOrder))

  return (
    <li className="grid grid-cols-[96px_1fr_auto] items-center gap-x-4 gap-y-2 overflow-hidden rounded-2xl bg-card md:grid-cols-[2fr_1fr_1fr_1fr_40px] md:rounded-none" data-testid="cart-line">
      <div className="row-span-3 flex items-center gap-4 md:row-span-1">
        <img src={line.image} alt="" width={70} height={70} className="h-full w-24 object-cover md:size-[70px]" />
        <div className="hidden md:block">
          <p className="font-bold">{line.name}</p>
          <p className="text-sm text-muted-foreground">ID do token: {line.tokenId}</p>
        </div>
      </div>
      <div className="pt-3 md:hidden">
        <p className="font-bold">{line.name}</p>
        <p className="text-sm text-muted-foreground">Edição: {line.editionLabel}</p>
      </div>
      <p className="col-start-2 font-bold text-primary md:col-start-auto md:font-normal" data-testid="line-unit-price">
        <span className="sr-only">Preço unitário: </span>
        {formatEth(line.unitPrice)}
        {priceChanged && (
          <span className="block text-xs font-normal text-muted-foreground">
            antes <s>{formatEth(line.previousUnitPrice)}</s>
          </span>
        )}
      </p>
      <QuantityStepper
        value={line.quantity}
        max={limit}
        label={`Quantidade de ${line.name}`}
        disabled={update.isPending}
        onChange={(quantity) => update.mutate({ lineId: line.id, quantity }, { onError })}
        className="col-start-3 row-start-1 row-end-3 pr-3 md:col-start-auto md:row-auto md:p-0"
      />
      <p className="hidden font-bold text-primary md:block">
        <span className="sr-only">Total da linha: </span>
        {formatEth(line.lineTotal)}
      </p>
      <button
        type="button"
        aria-label={`Remover ${line.name} do carrinho`}
        disabled={remove.isPending}
        onClick={() => remove.mutate(line.id, { onSuccess: () => toast.success(`${line.name} removido do carrinho.`), onError })}
        className="col-start-3 row-start-3 grid size-10 place-items-center justify-self-end text-muted-foreground hover:text-foreground md:col-start-auto md:row-auto"
      >
        <Trash2 className="size-5" />
      </button>
      {issue && (
        <p role="alert" className="col-span-full px-3 pb-3 text-sm text-destructive">
          {issue.available === 0 ? 'Edição esgotada. Remova o item para continuar.' : `Apenas ${issue.available} disponíveis. Ajuste a quantidade.`}
        </p>
      )}
    </li>
  )
}

function AlsoViewed() {
  const { data } = useQuery(queries.nftList({ tab: 'trending', pageSize: 5 }))
  if (!data?.items.length) return null
  return (
    <section aria-labelledby="also-viewed" className="mt-16 hidden md:block">
      <h2 id="also-viewed" className="border-b border-border pb-3 font-bold text-primary">
        Colecionadores também viram
      </h2>
      <ul className="mt-6 grid grid-cols-3 gap-6 lg:grid-cols-5">
        {data.items.map((nft) => (
          <li key={nft.id}>
            <NftCard nft={nft} />
          </li>
        ))}
      </ul>
    </section>
  )
}
