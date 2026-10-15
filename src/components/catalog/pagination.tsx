import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null
  const cell = 'grid size-8 place-items-center rounded-sm border border-border text-sm disabled:opacity-40'
  return (
    <nav aria-label="Paginação" className="flex justify-end gap-2">
      <button type="button" className={cell} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
        <ChevronLeft className="size-4" />
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPage(n)}
          aria-label={`Página ${n}`}
          aria-current={n === page ? 'page' : undefined}
          className={cn(cell, n === page && 'border-primary bg-primary font-bold text-primary-foreground')}
        >
          {n}
        </button>
      ))}
      <button type="button" className={cell} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Próxima página">
        <ChevronRight className="size-4" />
      </button>
    </nav>
  )
}
