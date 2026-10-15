import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Loader2, MailCheck, X, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import type { Order } from '@/contracts/api'
import { ApiError } from '@/api/client'
import { keys, queries } from '@/api/queries'
import { QueryError } from '@/components/feedback/query-error'
import { Skeleton } from '@/components/ui/skeleton'
import { clearAttempt, getAttempt } from '@/lib/checkout-attempt'
import { formatEth } from '@/lib/eth'
import { networkLabels, shortAddress, walletLabels } from '@/lib/labels'
import { useSession } from '@/lib/session'

export const Route = createFileRoute('/_private/pedidos/$orderId')({ component: OrderPage })

/**
 * Estado do pedido: carregado via REST (inclusive após refresh) e atualizado pelo
 * evento order.updated do Socket.IO. Confirmado e recusado são terminais.
 */
function OrderPage() {
  const { orderId } = Route.useParams()
  const userId = useSession()!.user.id
  const queryClient = useQueryClient()
  const order = useQuery(queries.order(userId, orderId))
  const status = order.data?.status

  useEffect(() => {
    if (!status || status === 'pending') return
    // Pedido terminal: encerra a tentativa de checkout e sincroniza o carrinho.
    if (getAttempt(userId)?.orderId === orderId) clearAttempt(userId)
    void queryClient.invalidateQueries({ queryKey: ['cart'] })
    void queryClient.invalidateQueries({ queryKey: keys.pendingOrders(userId) })
  }, [status, userId, orderId, queryClient])

  return (
    <main className="mx-auto flex max-w-[580px] flex-col px-4 py-10 md:py-20">
      {order.data ? (
        order.data.status === 'confirmed' ? (
          <Receipt order={order.data} />
        ) : (
          <OrderStatusCard order={order.data} />
        )
      ) : order.error instanceof ApiError && order.error.code === 'NOT_FOUND' ? (
        <div className="flex flex-col items-start gap-4">
          <h1 className="text-2xl font-bold">Pedido não encontrado</h1>
          <Link to="/" className="font-semibold text-primary underline">
            Voltar ao início
          </Link>
        </div>
      ) : order.isError ? (
        <QueryError error={order.error} onRetry={() => void order.refetch()} />
      ) : (
        <Skeleton className="h-96" aria-label="Carregando pedido" />
      )}
    </main>
  )
}

function OrderStatusCard({ order }: { order: Order }) {
  const pending = order.status === 'pending'
  return (
    <section className="flex flex-col items-center gap-5 border-b-8 border-primary bg-card p-8 text-center" aria-labelledby="order-title">
      {pending ? <Loader2 className="size-12 animate-spin text-primary" aria-hidden="true" /> : <XCircle className="size-12 text-destructive" aria-hidden="true" />}
      <h1 id="order-title" className="text-xl font-bold">
        {pending ? 'Pedido pendente' : 'Pagamento recusado'}
      </h1>
      <p role="status" data-testid="order-status" className="sr-only">
        {pending ? 'Pendente' : 'Recusado'}
      </p>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pending
          ? 'Aguardando a confirmação da rede. Você pode recarregar a página: o pedido não será duplicado.'
          : `${order.declineReason ?? 'O pagamento não foi concluído.'} Seus itens continuam no carrinho.`}
      </p>
      <p className="text-xs text-muted-foreground">Pedido {order.id}</p>
      {!pending && (
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/carrinho" className="rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
            Voltar ao carrinho
          </Link>
          <Link to="/pagamento" className="rounded-md border border-primary px-5 py-2.5 font-semibold text-primary">
            Tentar novamente
          </Link>
        </div>
      )}
    </section>
  )
}

/** Recibo: reproduz o snapshot imutável do pedido confirmado. */
function Receipt({ order }: { order: Order }) {
  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(order.updatedAt))
  return (
    <section className="relative flex flex-col border-b-8 border-primary bg-card" aria-labelledby="receipt-title">
      <Link to="/" aria-label="Fechar e voltar ao início" className="absolute top-4 right-4 text-primary">
        <X className="size-5" />
      </Link>
      <div className="flex flex-col items-center gap-3 p-6">
        <MailCheck className="size-16 text-primary" aria-hidden="true" />
        <h1 id="receipt-title" className="text-center font-bold text-muted-foreground">
          Seus NFTs agora estão na sua carteira
        </h1>
        <p role="status" data-testid="order-status" className="sr-only">
          Confirmado
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 border-y border-primary px-6 py-4 text-sm sm:grid-cols-4 sm:divide-x sm:divide-primary">
        <div className="sm:pr-3">
          <dt className="font-bold">ID da transação</dt>
          <dd data-testid="transaction-id">{shortAddress(order.transactionHash ?? '')}</dd>
        </div>
        <div className="sm:px-3">
          <dt>Data</dt>
          <dd>{date}</dd>
        </div>
        <div className="sm:px-3">
          <dt>Total</dt>
          <dd>{formatEth(order.total)}</dd>
        </div>
        <div className="sm:pl-3">
          <dt className="font-bold">Carteira</dt>
          <dd>{walletLabels[order.wallet.type]}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-4 px-6 py-6 sm:px-11">
        <h2 className="font-bold">Detalhes da transação</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="pb-2">NFTs</th>
              <th scope="col" className="pb-2 text-center">Edições</th>
              <th scope="col" className="pb-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody data-testid="receipt-lines">
            {order.lines.map((line) => (
              <tr key={`${line.nftId}:${line.editionId}`}>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <img src={line.image} alt="" width={64} height={64} className="size-16 rounded-sm object-cover" />
                    <span>
                      <span className="block font-bold">{line.name}</span>
                      <span className="text-muted-foreground">ID do token: {line.tokenId}</span>
                    </span>
                  </div>
                </td>
                <td className="text-center">(x {line.quantity})</td>
                <td className="text-right font-bold text-primary">{formatEth(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="flex flex-col gap-2 border-b border-border pb-3 text-sm">
          {order.discount !== '0' && (
            <div className="flex justify-between">
              <dt>Desconto</dt>
              <dd>(-) {formatEth(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Taxa de rede</dt>
            <dd>{formatEth(order.networkFee)}</dd>
          </div>
          <div className="flex justify-between font-bold">
            <dt>Total</dt>
            <dd className="text-primary" data-testid="receipt-total">
              {formatEth(order.total)}
            </dd>
          </div>
        </dl>
        <p className="text-center text-sm text-muted-foreground">
          Transação confirmada na {networkLabels[order.network]}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
        </p>
        {order.explorerUrl && (
          <a href={order.explorerUrl} target="_blank" rel="noreferrer noopener" className="self-center rounded-md bg-primary px-4 py-3 font-bold text-primary-foreground">
            Ver no Etherscan <span className="text-xs font-normal">(simulado)</span>
          </a>
        )}
      </div>
    </section>
  )
}
