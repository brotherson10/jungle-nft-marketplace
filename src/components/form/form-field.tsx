import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldProps {
  label: ReactNode
  error?: string
  required?: boolean
  hideLabel?: boolean
  className?: string
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; required?: boolean }) => ReactNode
}

/** Label + controle + mensagem de erro associada (aria-describedby). */
export function Field({ label, error, required, hideLabel, className, children }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id} className={cn('text-sm font-normal', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-primary">
            *
          </span>
        )}
      </Label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error ? errorId : undefined, required })}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

type TextFieldProps = Omit<ComponentProps<typeof Input>, 'id'> & {
  label: ReactNode
  error?: string
  hideLabel?: boolean
}

export function TextField({ label, error, required, hideLabel, className, ...props }: TextFieldProps) {
  return (
    <Field label={label} error={error} required={required} hideLabel={hideLabel} className={className}>
      {(a11y) => <Input {...props} {...a11y} />}
    </Field>
  )
}

export function PasswordField(props: Omit<TextFieldProps, 'type'>) {
  const [visible, setVisible] = useState(false)
  const { label, error, required, hideLabel, className, ...rest } = props
  return (
    <Field label={label} error={error} required={required} hideLabel={hideLabel} className={className}>
      {(a11y) => (
        <div className="relative">
          <Input {...rest} {...a11y} type={visible ? 'text' : 'password'} className="pr-11" />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
          >
            {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>
      )}
    </Field>
  )
}

/** Converte erros por campo da API e validação local em um mapa único. */
export type FieldErrors = Partial<Record<string, string>>
