import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet, useLocation } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { orderApi } from '@/api/endpoints'
import { keys, queries } from '@/api/queries'
import { MobileNav } from '@/components/layout/mobile-nav'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { Toaster } from '@/components/ui/sonner'
import { useSession } from '@/lib/session'
import { connectRealtime, useRealtimeStatus } from '@/realtime/socket'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-24">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-muted-foreground">O endereço acessado não existe ou foi removido.</p>
      <Link to="/" className="font-semibold text-primary underline">
        Voltar ao início
      </Link>
    </div>
  ),
})

/** Ciclo de vida da sessão: validação, limpeza de dados privados e um socket por sessão. */
function SessionEffects() {
  const queryClient = useQueryClient()
  const session = useSession()
  const previousUser = useRef(session?.user.id ?? null)

  // Valida a sessão restaurada; um 401 limpa a sessão local (interceptor do Axios).
  useQuery({ ...queries.session(session?.token ?? ''), enabled: !!session })

  useEffect(() => {
    const userId = session?.user.id ?? null
    if (previousUser.current === userId) return
    // Logout/troca de usuário: cancela consultas e descarta dados privados e carrinho anteriores.
    void queryClient.cancelQueries({ queryKey: ['user'] })
    queryClient.removeQueries({ queryKey: ['user'] })
    queryClient.removeQueries({ queryKey: ['cart'] })
    queryClient.removeQueries({ queryKey: ['session'] })
    previousUser.current = userId
  }, [queryClient, session?.user.id])

  // Um socket por sessão; encerrar o anterior também libera seus listeners.
  const token = session?.token
  const userId = session?.user.id
  useEffect(
    () =>
      connectRealtime(queryClient, token && userId ? { token, userId } : null, {
        onCartItemChanged: (name) => toast.info(`O preço ou a disponibilidade de ${name} mudou. Resumo atualizado.`),
      }),
    [queryClient, token, userId],
  )
  return null
}

/** Pedido pendente recuperado via REST após refresh ou reconexão. */
function PendingOrderBanner() {
  const userId = useSession()?.user.id
  const { pathname } = useLocation()
  const { data } = useQuery({
    queryKey: keys.pendingOrders(userId ?? ''),
    queryFn: ({ signal }) => orderApi.pending({ signal }),
    enabled: !!userId,
  })
  const pending = data?.[0]
  if (!pending || pathname.startsWith('/pedidos/')) return null
  return (
    <div role="status" className="bg-band px-6 py-3 text-center text-sm">
      Você tem um pedido aguardando confirmação.{' '}
      <Link to="/pedidos/$orderId" params={{ orderId: pending.id }} className="font-semibold text-primary underline">
        Acompanhar pedido
      </Link>
    </div>
  )
}

function RootLayout() {
  const realtime = useRealtimeStatus()
  return (
    <>
      <a href="#conteudo" className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      <SessionEffects />
      <SiteHeader />
      <PendingOrderBanner />
      <div id="conteudo" tabIndex={-1} className="pb-24 outline-none md:pb-0">
        <Outlet />
      </div>
      <SiteFooter />
      <MobileNav />
      <p data-testid="realtime-status" className="sr-only">
        Tempo real: {realtime}
      </p>
      {/* Embaixo, acima da navegação inferior no mobile, para não cobrir as ações do topo. */}
      <Toaster position="bottom-center" mobileOffset={{ bottom: 88 }} richColors closeButton />
    </>
  )
}
