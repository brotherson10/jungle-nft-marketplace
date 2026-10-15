import { createFileRoute } from '@tanstack/react-router'
import { AuthDialog } from '@/components/auth/auth-dialog'
import { CatalogHome } from '@/components/catalog/catalog-home'
import { validateRedirect } from './entrar'

export const Route = createFileRoute('/cadastro')({
  validateSearch: validateRedirect,
  component: SignupPage,
})

function SignupPage() {
  const { redirect } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <>
      <div aria-hidden="true" inert>
        <CatalogHome search={{}} onSearch={(patch) => void navigate({ to: '/', search: patch })} />
      </div>
      <AuthDialog mode="signup" redirect={redirect} />
    </>
  )
}
