import { useId, useState } from 'react'
import { toast } from 'sonner'
import type { Quote } from '@/contracts/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/api/client'
import { useCartMutations } from '@/hooks/use-cart'

export function CouponForm({ coupon }: { coupon: Quote['coupon'] }) {
  const id = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const { applyCoupon, removeCoupon } = useCartMutations()

  if (coupon)
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm border border-border p-3 text-sm">
        <span>
          Cupom <strong>{coupon.code}</strong> aplicado
        </span>
        <Button
          variant="link"
          disabled={removeCoupon.isPending}
          onClick={() => removeCoupon.mutate(undefined, { onSuccess: () => toast.success('Cupom removido.') })}
        >
          Remover
        </Button>
      </div>
    )

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!code.trim()) return setError('Informe um código promocional.')
        setError(undefined)
        applyCoupon.mutate(code, {
          onSuccess: () => {
            setCode('')
            toast.success('Cupom aplicado.')
          },
          onError: (e) => setError(e instanceof ApiError ? e.message : 'Não foi possível aplicar o cupom.'),
        })
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold">
        Código promocional
      </label>
      <div className="flex">
        <Input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="rounded-r-none"
        />
        <Button type="submit" className="h-10 rounded-l-none px-5" disabled={applyCoupon.isPending}>
          Aplicar
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
