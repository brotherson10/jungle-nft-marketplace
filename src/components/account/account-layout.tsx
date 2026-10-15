import { Link, useNavigate } from '@tanstack/react-router'
import { Activity, Download, Heart, LifeBuoy, LogOut, MapPin, Tag, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLogout } from '@/hooks/use-auth'
import { notAvailable } from '@/lib/out-of-scope'
import { cn } from '@/lib/utils'

const item = 'flex shrink-0 items-center gap-3 px-3 py-3 text-sm text-primary md:border-l-4 md:border-transparent aria-[current=page]:border-primary aria-[current=page]:font-semibold'

export function AccountLayout({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  const logout = useLogout()
  return (
    <main className="mx-auto grid max-w-[1200px] gap-8 px-4 py-6 md:grid-cols-[310px_1fr] md:px-6 md:py-8">
      <aside aria-label="Meu perfil" className="h-fit rounded-sm bg-card md:py-4">
        <p className="hidden px-3 pb-2 text-lg font-bold md:block">Meu perfil</p>
        <nav className="flex flex-wrap md:flex-col">
          <Link to="/perfil" className={item}>
            <User className="size-4" aria-hidden="true" /> Dados do perfil
          </Link>
          <Link to="/carteiras" className={item}>
            <MapPin className="size-4" aria-hidden="true" /> Carteiras
          </Link>
          <Link to="/" search={{ favorites: true }} className={item}>
            <Heart className="size-4" aria-hidden="true" /> Lista de interesse
          </Link>
          {[
            ['Atividade', Activity],
            ['Ofertas', Tag],
            ['Arquivos baixados', Download],
            ['Suporte', LifeBuoy],
          ].map(([label, Icon]) => {
            const I = Icon as typeof User
            return (
              <button key={label as string} type="button" className={cn(item, 'hidden md:flex')} onClick={() => notAvailable(label as string)}>
                <I className="size-4" aria-hidden="true" /> {label as string}
              </button>
            )
          })}
          <button
            type="button"
            className={cn(item, 'font-semibold md:border-t md:border-t-border')}
            disabled={logout.isPending}
            onClick={async () => {
              await navigate({ to: '/' })
              logout.mutate()
            }}
          >
            <LogOut className="size-4" aria-hidden="true" /> Sair
          </button>
        </nav>
      </aside>
      <div className="flex flex-col gap-10">
        <h1 className="text-lg font-bold">{title}</h1>
        {children}
      </div>
    </main>
  )
}
