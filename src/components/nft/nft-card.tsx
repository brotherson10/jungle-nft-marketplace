import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/contracts/api'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { FavoriteButton } from './favorite-button'

export function NftCard({ nft, className, eager }: { nft: NftSummary; className?: string; eager?: boolean }) {
  return (
    <article className={cn('group relative flex flex-col gap-3', className)}>
      <div className="relative aspect-[25/28] overflow-hidden rounded-xl bg-card p-2 sm:p-4">
        <img
          src={nft.image}
          alt={nft.name}
          width={250}
          height={250}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="size-full rounded-lg object-cover"
        />
        {nft.badge === 'raro' && (
          <span className="absolute top-2 left-2 rounded-sm bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground sm:top-4 sm:left-0">
            RARO
          </span>
        )}
        <FavoriteButton
          nftId={nft.id}
          nftName={nft.name}
          className="absolute top-3 right-3 z-10 size-9 border-none bg-background/80 sm:top-5 sm:right-5"
        />
      </div>
      <div className="flex flex-col gap-1 text-sm sm:text-base">
        {/* O link cobre o card inteiro; o favorito fica acima dele (z-10). */}
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-['']">
          {nft.name}
        </Link>
        <p className="font-bold text-primary" data-testid="nft-card-price">
          <span className="sr-only">Preço: </span>
          {formatEth(nft.price)}
          {nft.compareAtPrice && (
            <s className="ml-2 font-normal text-muted-foreground">
              <span className="sr-only">Preço anterior: </span>
              {formatEth(nft.compareAtPrice)}
            </s>
          )}
        </p>
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="aspect-[25/28] rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}
