import { createFileRoute } from '@tanstack/react-router'
import { AuthDialog } from '@/components/auth/auth-dialog'
import { CatalogHome } from '@/components/catalog/catalog-home'

/** `redirect` preserva o fluxo anterior para retomada após o login. */
export const validateRedirect = (search: Record<string, unknown>): { redirect?: string } => ({
  redirect: typeof search.redirect === 'string' && search.redirect.startsWith('/') && !search.redirect.startsWith('//') ? search.redirect : undefined,
})

export const Route = createFileRoute('/entrar')({
  validateSearch: validateRedirect,
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <>
      <div aria-hidden="true" inert>
        <CatalogHome search={{}} onSearch={(patch) => void navigate({ to: '/', search: patch })} />
      </div>
      <AuthDialog mode="login" redirect={redirect} />
    </>
  )
}
