import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart, User, X } from 'lucide-react'
import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { useCartCount } from '@/hooks/use-cart'
import { notAvailable } from '@/lib/out-of-scope'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

const navItem = 'relative py-2 text-sm transition-colors hover:text-primary lg:text-base'
const activeItem = 'text-primary font-semibold after:absolute after:inset-x-0 after:-bottom-[18px] after:h-0.5 after:bg-primary'

export function SiteHeader() {
  const session = useSession()
  const count = useCartCount()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [searching, setSearching] = useState(false)
  const [term, setTerm] = useState('')
  const searchId = useId()
  const market = /^\/(nft|carrinho|pagamento)/.test(pathname)

  return (
    <header className="hidden border-b border-border md:block">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between gap-6 px-6">
        <Link to="/" className="text-sm font-bold tracking-widest">
          KURIO
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-6 lg:gap-10">
          <Link to="/" className={cn(navItem, pathname === '/' && activeItem)} aria-current={pathname === '/' ? 'page' : undefined}>
            Início
          </Link>
          <Link to="/" hash="catalogo" className={cn(navItem, market && activeItem)}>
            Mercado
          </Link>
          <button type="button" className={navItem} onClick={() => notAvailable('A seção Criadores')}>
            Criadores
          </button>
          <button type="button" className={navItem} onClick={() => notAvailable('A seção Aprenda')}>
            Aprenda
          </button>
        </nav>
        <div className="flex items-center gap-5">
          {searching ? (
            <form
              role="search"
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void navigate({ to: '/', search: { q: term.trim() || undefined }, hash: 'catalogo' })
                setSearching(false)
              }}
            >
              <label htmlFor={searchId} className="sr-only">
                Buscar NFTs
              </label>
              <Input id={searchId} autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar NFTs" className="h-9 w-44" />
              <button type="button" aria-label="Fechar busca" onClick={() => setSearching(false)}>
                <X className="size-5" />
              </button>
            </form>
          ) : (
            <button type="button" aria-label="Abrir busca" onClick={() => setSearching(true)}>
              <Search className="size-6" />
            </button>
          )}
          <Link to="/carrinho" className="relative" aria-label={`Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}`}>
            <ShoppingCart className="size-6" aria-hidden="true" />
            {count > 0 && (
              <span aria-hidden="true" data-testid="cart-count" className="absolute -top-2 -right-2 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
          {session ? (
            <Link to="/perfil" className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground" data-testid="user-menu">
              <User className="size-4" aria-hidden="true" />
              <span className="max-w-32 truncate">{session.user.displayName}</span>
            </Link>
          ) : (
            <Link to="/entrar" search={{ redirect: pathname === '/entrar' ? undefined : pathname }} className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground">
              <LogIn className="size-4" aria-hidden="true" /> Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
