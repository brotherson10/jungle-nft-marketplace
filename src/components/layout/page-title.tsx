import { useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

/** Título de página com "voltar" no mobile, conforme frames mobile do Figma. */
export function PageTitle({ children, action }: { children?: ReactNode; action?: ReactNode }) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-4 py-4 md:hidden">
      <button type="button" aria-label="Voltar" onClick={() => router.history.back()} className="grid size-10 place-items-center rounded-full bg-card">
        <ChevronLeft className="size-5" />
      </button>
      {children ? <h1 className="flex-1 text-xl font-bold">{children}</h1> : <span className="flex-1" />}
      {action}
    </div>
  )
}
