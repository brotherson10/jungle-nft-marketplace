import { useLocation, useNavigate } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { useFavorites, useToggleFavorite } from '@/hooks/use-favorites'
import { useSession } from '@/lib/session'
import { cn } from '@/lib/utils'

/** Favorito do usuário autenticado; visitante é levado ao login e volta para a mesma tela. */
export function FavoriteButton({ nftId, nftName, className, withLabel }: { nftId: string; nftName: string; className?: string; withLabel?: boolean }) {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const { data } = useFavorites()
  const toggle = useToggleFavorite()
  const active = !!data?.nftIds.includes(nftId)

  return (
    <button
      type="button"
      aria-pressed={active}
      // Nome constante; o estado é exposto por aria-pressed (botão toggle).
      aria-label={`Favoritar ${nftName}`}
      onClick={() => {
        if (!session) return void navigate({ to: '/entrar', search: { redirect: location.href } })
        toggle.mutate({ nftId, favorite: !active })
      }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border border-primary text-primary transition-colors hover:bg-primary/10',
        className,
      )}
    >
      <Heart aria-hidden="true" className={cn('size-4', active && 'fill-current')} />
      {withLabel && <span aria-hidden="true">Favoritar</span>}
    </button>
  )
}
