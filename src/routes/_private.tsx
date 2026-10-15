import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getSession, useSession } from '@/lib/session'

/** Rotas que exigem autenticação. A validade real da sessão é confirmada pela API. */
export const Route = createFileRoute('/_private')({
  beforeLoad: ({ location }) => {
    if (!getSession()) throw redirect({ to: '/entrar', search: { redirect: location.href } })
  },
  component: PrivateLayout,
})

function PrivateLayout() {
  const session = useSession()
  const router = useRouter()

  // Sessão expirada ou encerrada durante a navegação: revalida a rota e o beforeLoad
  // redireciona ao login com o destino atual para retomada.
  useEffect(() => {
    if (!session) void router.invalidate()
  }, [session, router])

  return session ? <Outlet /> : null
}
