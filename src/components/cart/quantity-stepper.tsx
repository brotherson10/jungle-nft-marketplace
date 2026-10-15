import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Quantidade inteira entre min e max, operável por teclado. */
export function QuantityStepper({
  value,
  max,
  min = 1,
  onChange,
  label,
  disabled,
  className,
}: {
  value: number
  max: number
  min?: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  className?: string
}) {
  const button =
    'grid size-7 place-items-center rounded-full bg-primary text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground'
  return (
    <div role="group" aria-label={label} className={cn('flex items-center gap-3', className)}>
      <button type="button" className={button} disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label="Diminuir quantidade">
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <output aria-live="polite" className="min-w-5 text-center">
        {value}
      </output>
      <button type="button" className={button} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label="Aumentar quantidade">
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
