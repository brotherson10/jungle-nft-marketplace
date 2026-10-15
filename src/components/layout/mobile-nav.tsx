import { Link } from '@tanstack/react-router'
import { Heart, Home, ScanLine, ShoppingCart, User } from 'lucide-react'
import { useCartCount } from '@/hooks/use-cart'
import { notAvailable } from '@/lib/out-of-scope'
import { useSession } from '@/lib/session'

const item = 'grid size-11 place-items-center rounded-full text-muted-foreground aria-[current=page]:text-primary'

/** Navegação inferior (mobile e tablet), conforme o frame mobile do Figma. */
export function MobileNav() {
  const count = useCartCount()
  const session = useSession()
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-4">
        <Link to="/" className={item} aria-label="Início" activeOptions={{ exact: true, includeSearch: false }}>
          <Home className="size-5" />
        </Link>
        <Link to="/" search={{ favorites: true }} className={item} aria-label="Favoritos">
          <Heart className="size-5" />
        </Link>
        <button type="button" onClick={() => notAvailable('O leitor de QR code')} aria-label="Escanear QR code" className="-mt-8 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <ScanLine className="size-6" />
        </button>
        <Link to="/carrinho" className={`${item} relative`} aria-label={`Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}`}>
          <ShoppingCart className="size-5" />
          {count > 0 && (
            <span aria-hidden="true" className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </Link>
        <Link to={session ? '/perfil' : '/entrar'} className={item} aria-label={session ? 'Perfil' : 'Entrar'}>
          <User className="size-5" />
        </Link>
      </div>
    </nav>
  )
}
