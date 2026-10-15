import type { Quote } from '@/contracts/api'
import { Skeleton } from '@/components/ui/skeleton'
import { cmpEth, formatEth } from '@/lib/eth'

/** Valores exatamente como retornados pela cotação da API. */
export function OrderSummary({ quote }: { quote: Pick<Quote, 'subtotal' | 'discount' | 'networkFee' | 'total' | 'coupon'> }) {
  return (
    <dl className="flex flex-col gap-3 text-sm sm:text-base" data-testid="order-summary">
      <div className="flex justify-between gap-4">
        <dt>Subtotal</dt>
        <dd data-testid="summary-subtotal" className="whitespace-nowrap">{formatEth(quote.subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>{quote.coupon?.label ?? 'Desconto do lançamento'}</dt>
        <dd data-testid="summary-discount" className="whitespace-nowrap">
          {cmpEth(quote.discount, '0') > 0 ? `(-) ${formatEth(quote.discount)}` : '(-) 0.00 ETH'}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Taxa de rede</dt>
        <dd className="text-right">
          <span data-testid="summary-fee">{formatEth(quote.networkFee)}</span>
          <span className="block text-xs text-primary">Taxa estimada</span>
        </dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-border pt-3 font-bold">
        <dt>Total</dt>
        <dd className="text-lg text-primary" data-testid="summary-total">
          {formatEth(quote.total)}
        </dd>
      </div>
    </dl>
  )
}

export function OrderSummarySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}
