import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { CreateOrderRequest, Network, Profile, Quote, Wallets, WalletSlot, WalletType } from '@/contracts/api'
import { ApiError } from '@/api/client'
import { accountApi } from '@/api/endpoints'
import { keys, queries } from '@/api/queries'
import { OrderSummary, OrderSummarySkeleton } from '@/components/cart/order-summary'
import { QueryError } from '@/components/feedback/query-error'
import { Field, TextField, type FieldErrors } from '@/components/form/form-field'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageTitle } from '@/components/layout/page-title'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useCart, useCartMutations } from '@/hooks/use-cart'
import { pendingAttempt, useCreateOrder } from '@/hooks/use-checkout'
import { formatEth } from '@/lib/eth'
import { networkLabels, networks, shortAddress, walletLabels, walletTypes } from '@/lib/labels'
import { useSession } from '@/lib/session'

export const Route = createFileRoute('/_private/pagamento')({ component: CheckoutPage })

interface CheckoutValues {
  displayName: string
  username: string
  email: string
  network: Network
  note: string
  walletSlot: WalletSlot | ''
  provider: WalletType | ''
}

// Rascunho por usuário: sobrevive a refresh e à expiração da sessão durante o checkout.
const draftKey = (userId: string) => `kurio.checkout.draft.${userId}`
function loadDraft(userId: string): CheckoutValues | null {
  try {
    const raw = sessionStorage.getItem(draftKey(userId))
    return raw ? (JSON.parse(raw) as CheckoutValues) : null
  } catch {
    return null
  }
}

function CheckoutPage() {
  const userId = useSession()!.user.id
  const profile = useQuery(queries.profile(userId))
  const wallets = useQuery(queries.wallets(userId))
  const failed = profile.isError ? profile : wallets.isError ? wallets : null

  return (
    <main className="mx-auto max-w-[1200px] px-4 md:px-6">
      <PageTitle>Pagamento com carteira</PageTitle>
      <Breadcrumb current="Pagamento" />
      <h1 className="sr-only max-md:hidden">Pagamento</h1>
      {failed ? (
        <QueryError error={failed.error} onRetry={() => void failed.refetch()} />
      ) : profile.data && wallets.data ? (
        <CheckoutForm userId={userId} profile={profile.data} wallets={wallets.data} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_405px]" aria-busy="true" aria-label="Carregando pagamento">
          <Skeleton className="h-96" />
          <OrderSummarySkeleton />
        </div>
      )}
    </main>
  )
}

function CheckoutForm({ userId, profile, wallets }: { userId: string; profile: Profile; wallets: Wallets }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const defaultSlot: WalletSlot | '' = wallets.primary ? 'primary' : wallets.secondary ? 'secondary' : ''
  const [values, setValues] = useState<CheckoutValues>(
    () =>
      loadDraft(userId) ?? {
        displayName: profile.displayName,
        username: profile.username,
        email: profile.email,
        network: (defaultSlot && wallets[defaultSlot]?.network) || 'ethereum',
        note: '',
        walletSlot: defaultSlot,
        provider: (defaultSlot && wallets[defaultSlot]?.type) || '',
      },
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [reviewed, setReviewed] = useState<Quote | null>(null)
  const [submitError, setSubmitError] = useState<{ message: string; retry?: boolean; toCart?: boolean }>()
  const [attempt] = useState(() => pendingAttempt(userId))

  const cart = useCart(values.network)
  const { acceptPrices } = useCartMutations()
  const connection = useQuery(queries.walletConnection(userId))
  const connect = useMutation({ mutationFn: (v: { slot: WalletSlot; provider: WalletType }) => accountApi.connect(v.slot, v.provider) })
  const disconnect = useMutation({ mutationFn: accountApi.disconnect })
  const createOrder = useCreateOrder(userId)

  useEffect(() => sessionStorage.setItem(draftKey(userId), JSON.stringify(values)), [userId, values])

  const quote = cart.data?.quote
  const connected = !!connection.data && connection.data.slot === values.walletSlot && connection.data.provider === values.provider
  const reviewing = reviewed !== null
  const stale = !!reviewed && !!quote && quote.id !== reviewed.id
  const update = (patch: Partial<CheckoutValues>) => {
    setValues((v) => ({ ...v, ...patch }))
    // Qualquer alteração de dados exige nova revisão.
    setReviewed(null)
  }
  const set = (field: 'displayName' | 'username' | 'email' | 'note') => (e: { target: { value: string } }) => update({ [field]: e.target.value })

  const review = (event: FormEvent) => {
    event.preventDefault()
    const next: FieldErrors = {}
    if (!values.displayName.trim()) next.displayName = 'Informe o nome de exibição.'
    if (!values.username.trim()) next.username = 'Informe o nome de usuário.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Informe um e-mail válido.'
    if (!values.walletSlot) next.walletSlot = 'Selecione uma carteira cadastrada.'
    if (!values.provider) next.provider = 'Selecione o provedor da carteira.'
    else if (!connected) next.provider = 'Conecte a carteira selecionada para revisar o pedido.'
    setErrors(next)
    setSubmitError(undefined)
    if (Object.keys(next).length) return toast.error('Revise os dados do pagamento.')
    if (!quote || quote.issues.length) return setSubmitError({ message: 'Há itens indisponíveis no carrinho.', toCart: true })
    setReviewed(quote)
  }

  const confirm = (body: CreateOrderRequest) => {
    setSubmitError(undefined)
    createOrder.mutate(body, {
      onSuccess: (order) => {
        sessionStorage.removeItem(draftKey(userId))
        void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id } })
      },
      onError: (error) => {
        if (error.code === 'QUOTE_CHANGED') {
          void queryClient.invalidateQueries({ queryKey: ['cart'] })
          setSubmitError({ message: 'Preços ou taxas mudaram. Revise os novos valores e confirme novamente.' })
        } else if (error.code === 'AVAILABILITY_CONFLICT') {
          setSubmitError({ message: 'A disponibilidade de um ou mais itens mudou.', toCart: true })
        } else if (error.code === 'WALLET_DISCONNECTED') {
          void queryClient.invalidateQueries({ queryKey: keys.walletConnection(userId) })
          setReviewed(null)
          setSubmitError({ message: error.message })
        } else if (error.transient) {
          setSubmitError({ message: 'Não conseguimos confirmar o envio do pedido. Tente novamente: a mesma tentativa será recuperada, sem duplicar a compra.', retry: true })
        } else setSubmitError({ message: error.message })
      },
    })
  }

  const body: CreateOrderRequest | null =
    reviewed && values.walletSlot && values.provider
      ? {
          quoteId: reviewed.id,
          walletSlot: values.walletSlot,
          provider: values.provider,
          network: values.network,
          collector: { displayName: values.displayName.trim(), username: values.username.trim(), email: values.email.trim() },
          note: values.note.trim(),
        }
      : null

  const registered = (['primary', 'secondary'] as const).filter((slot) => wallets[slot])

  if (cart.data && cart.data.lines.length === 0 && !attempt)
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg bg-card p-8">
        <p className="text-lg font-semibold">Seu carrinho está vazio.</p>
        <Link to="/" className="font-semibold text-primary underline">
          Explorar NFTs
        </Link>
      </div>
    )

  return (
    <form onSubmit={review} noValidate className="grid gap-10 lg:grid-cols-[1fr_405px]">
      {attempt && (
        <div role="status" className="rounded-lg border border-primary bg-band p-4 text-sm lg:col-span-2">
          {attempt.orderId ? (
            <>
              Você já enviou um pedido.{' '}
              <Link to="/pedidos/$orderId" params={{ orderId: attempt.orderId }} className="font-semibold text-primary underline">
                Acompanhar pedido
              </Link>
            </>
          ) : (
            <span className="flex flex-wrap items-center gap-3">
              Um envio anterior não foi confirmado.
              <Button type="button" size="sm" disabled={createOrder.isPending} onClick={() => confirm(attempt.body)}>
                Retomar envio
              </Button>
            </span>
          )}
        </div>
      )}

      <section aria-labelledby="collector-title" className="flex flex-col gap-6">
        <h2 id="collector-title" className="font-bold">
          Perfil do colecionador
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <TextField label="Nome de exibição" required value={values.displayName} error={errors.displayName} onChange={set('displayName')} autoComplete="name" />
          <TextField label="Nome de usuário" required value={values.username} error={errors.username} onChange={set('username')} autoComplete="username" />
          <TextField label="E-mail" required type="email" value={values.email} error={errors.email} onChange={set('email')} autoComplete="email" />
          <Field label="Rede" required error={errors.network}>
            {(a11y) => (
              <Select value={values.network} onValueChange={(v) => update({ network: v as Network })}>
                <SelectTrigger {...a11y} className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {networks.map((n) => (
                    <SelectItem key={n} value={n}>
                      {networkLabels[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
        <Field label="Observação do colecionador (opcional)">
          {(a11y) => <Textarea {...a11y} value={values.note} onChange={set('note')} maxLength={500} className="min-h-36" />}
        </Field>
      </section>

      <aside aria-labelledby="your-nfts" className="flex flex-col gap-5">
        <h2 id="your-nfts" className="font-bold">
          Seus NFTs
        </h2>
        <ul className="flex flex-col gap-2" aria-busy={cart.isFetching}>
          {cart.data
            ? cart.data.lines.map((line) => (
                <li key={line.id} className="flex items-center gap-3 bg-card pr-3 text-sm">
                  <img src={line.image} alt="" width={70} height={70} className="size-16 object-cover" />
                  <span className="flex-1">
                    <span className="block font-bold">{line.name}</span>
                    <span className="text-muted-foreground">Edição {line.editionLabel}</span>
                  </span>
                  <span className="text-muted-foreground">(x {line.quantity})</span>
                  <span className="font-bold text-primary">{formatEth(line.lineTotal)}</span>
                </li>
              ))
            : [0, 1].map((i) => <Skeleton key={i} className="h-16" />)}
        </ul>
        <div aria-live="polite">{quote ? <OrderSummary quote={quote} /> : <OrderSummarySkeleton />}</div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-bold">Carteira conectada</legend>
          {registered.length ? (
            <RadioGroup
              value={values.walletSlot}
              onValueChange={(slot) => update({ walletSlot: slot as WalletSlot, provider: wallets[slot as WalletSlot]?.type ?? values.provider })}
              aria-describedby={errors.walletSlot ? 'wallet-slot-error' : undefined}
            >
              {registered.map((slot) => {
                const wallet = wallets[slot]!
                return (
                  <label key={slot} className="flex cursor-pointer items-start gap-3 rounded-lg bg-card p-4 has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary">
                    <RadioGroupItem value={slot} className="mt-1" />
                    <span className="text-sm">
                      <span className="block font-bold">{wallet.nickname}</span>
                      <span className="block text-muted-foreground">{wallet.ensName ? `${wallet.ensName}.eth` : shortAddress(wallet.address)}</span>
                      <span className="text-muted-foreground">Rede {networkLabels[wallet.network]}</span>
                    </span>
                  </label>
                )
              })}
            </RadioGroup>
          ) : (
            <p className="text-sm">
              Nenhuma carteira cadastrada.{' '}
              <Link to="/carteiras" className="font-semibold text-primary underline">
                Cadastrar carteira
              </Link>
            </p>
          )}
          {errors.walletSlot && (
            <p id="wallet-slot-error" className="text-sm text-destructive">
              {errors.walletSlot}
            </p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-bold">Carteira e rede</legend>
          <RadioGroup value={values.provider} onValueChange={(p) => update({ provider: p as WalletType })} aria-describedby={errors.provider ? 'provider-error' : undefined}>
            {walletTypes.map((type) => (
              <label key={type} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4 text-sm has-[[data-state=checked]]:border-primary">
                <RadioGroupItem value={type} />
                {walletLabels[type]}
              </label>
            ))}
          </RadioGroup>
          {errors.provider && (
            <p id="provider-error" className="text-sm text-destructive">
              {errors.provider}
            </p>
          )}
          {values.walletSlot && values.provider && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-live="polite">
              {connected ? (
                <>
                  <span data-testid="wallet-status">Conectada: {shortAddress(connection.data!.address)}</span>
                  <Button type="button" variant="outline" size="sm" disabled={disconnect.isPending} onClick={() => disconnect.mutate(undefined, { onSuccess: () => { setReviewed(null); void connection.refetch(); toast.info('Carteira desconectada.') } })}>
                    Desconectar
                  </Button>
                </>
              ) : (
                <>
                  <span data-testid="wallet-status">Carteira não conectada</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={connect.isPending}
                    onClick={() =>
                      connect.mutate(
                        { slot: values.walletSlot as WalletSlot, provider: values.provider as WalletType },
                        {
                          onSuccess: (data) => {
                            queryClient.setQueryData(keys.walletConnection(userId), data)
                            toast.success(`${walletLabels[data.provider]} conectada.`)
                          },
                          onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Não foi possível conectar a carteira.'),
                        },
                      )
                    }
                  >
                    {connect.isPending ? 'Conectando…' : 'Conectar carteira'}
                  </Button>
                </>
              )}
            </div>
          )}
        </fieldset>

        {reviewed && (
          <section aria-labelledby="review-title" className="flex flex-col gap-2 rounded-lg border border-primary p-4 text-sm" data-testid="order-review">
            <h3 id="review-title" className="font-bold">
              Revisão do pedido
            </h3>
            <p>
              {values.displayName} · {values.email}
            </p>
            <p>
              {walletLabels[values.provider as WalletType]} · Rede {networkLabels[values.network]}
            </p>
            <p className="font-bold">Total revisado: {formatEth(reviewed.total)}</p>
          </section>
        )}
        {stale && (
          <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive p-4 text-sm">
            <p>Os valores mudaram desde a sua revisão. Confira o novo resumo e revise novamente.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                acceptPrices.mutate()
                setSubmitError(undefined)
                setReviewed(quote!)
              }}
            >
              Revisar novamente
            </Button>
          </div>
        )}
        {submitError && !stale && (
          <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive p-4 text-sm">
            <p>{submitError.message}</p>
            {submitError.toCart && (
              <Link to="/carrinho" className="font-semibold text-primary underline">
                Voltar ao carrinho
              </Link>
            )}
            {submitError.retry && body && (
              <Button type="button" variant="outline" disabled={createOrder.isPending} onClick={() => confirm(body)}>
                Tentar novamente
              </Button>
            )}
          </div>
        )}

        {reviewing ? (
          <div className="flex flex-col gap-3">
            <Button type="button" size="lg" disabled={!body || stale || cart.isFetching || createOrder.isPending} onClick={() => body && confirm(body)}>
              {createOrder.isPending ? 'Enviando pedido…' : 'Confirmar compra'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setReviewed(null)}>
              Editar dados
            </Button>
          </div>
        ) : (
          <Button type="submit" size="lg" disabled={!cart.data || cart.isFetching}>
            Revisar pedido
          </Button>
        )}
      </aside>
    </form>
  )
}
