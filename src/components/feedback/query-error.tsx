import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/api/client'

/** Falha de carregamento com nova tentativa explícita. */
export function QueryError({ error, onRetry, title = 'Não foi possível carregar.' }: { error: unknown; onRetry: () => void; title?: string }) {
  const message = error instanceof ApiError ? error.message : 'Erro inesperado.'
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-5">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RotateCw aria-hidden="true" /> Tentar novamente
      </Button>
    </div>
  )
}
