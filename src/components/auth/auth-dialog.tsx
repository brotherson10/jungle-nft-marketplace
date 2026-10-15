import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { PasswordField, TextField, type FieldErrors } from '@/components/form/form-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useLogin, useRegister } from '@/hooks/use-auth'
import { notAvailable } from '@/lib/out-of-scope'
import { consumeEndReason } from '@/lib/session'
import { cn } from '@/lib/utils'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Login e cadastro: modal sobre o Início no desktop e tela cheia no mobile (Figma). */
export function AuthDialog({ mode, redirect }: { mode: 'login' | 'signup'; redirect?: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const [expired] = useState(() => consumeEndReason() === 'expired')
  // Retorna ao fluxo anterior (href completo, com busca), sem empilhar o login no histórico.
  const done = () => router.history.replace(redirect ?? '/')

  return (
    <Dialog open onOpenChange={(open) => !open && void navigate({ to: '/' })}>
      <DialogContent className="flex h-dvh max-w-none flex-col justify-center gap-6 rounded-none border-0 border-b-8 border-primary bg-card px-7 sm:h-auto sm:max-w-[500px] sm:px-20 sm:py-14">
        <p className="text-center text-3xl font-bold tracking-widest sm:hidden" aria-hidden="true">
          KURIO
        </p>
        <nav aria-label="Acesso" className="flex justify-center gap-2 text-lg">
          <Link to="/entrar" search={{ redirect }} className={cn(mode === 'login' && 'text-primary')} aria-current={mode === 'login' ? 'page' : undefined}>
            Entrar
          </Link>
          <span aria-hidden="true" className="text-primary">
            |
          </span>
          <Link to="/cadastro" search={{ redirect }} className={cn(mode === 'signup' && 'text-primary')} aria-current={mode === 'signup' ? 'page' : undefined}>
            Criar conta
          </Link>
        </nav>
        <DialogTitle className="sr-only">{mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}</DialogTitle>
        <DialogDescription className="text-center text-xs text-foreground">
          {mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
        </DialogDescription>
        {expired && (
          <p role="alert" className="rounded-sm border border-primary p-3 text-sm">
            Sua sessão expirou. Entre novamente para continuar de onde parou.
          </p>
        )}
        {mode === 'login' ? <LoginForm onDone={done} /> : <SignupForm onDone={done} />}
        <div className="flex items-center gap-3 text-xs">
          <span className="h-px flex-1 bg-border" />
          Ou continue com
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="flex flex-col gap-3">
          {['Google', 'Facebook'].map((provider) => (
            <Button key={provider} type="button" variant="outline" className="h-10 font-normal" onClick={() => notAvailable(`O login com ${provider}`)}>
              Continuar com {provider}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const login = useLogin()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next: FieldErrors = {}
    if (!EMAIL.test(values.email)) next.email = 'Informe um e-mail válido.'
    if (!values.password) next.password = 'Informe a senha.'
    setErrors(next)
    setFormError(undefined)
    if (Object.keys(next).length) return
    login.mutate(values, {
      onSuccess: (session) => {
        toast.success(`Bem-vindo(a), ${session.user.displayName}.`)
        onDone()
      },
      onError: (error) => setFormError(error instanceof ApiError ? error.message : 'Não foi possível entrar.'),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <TextField label="E-mail" hideLabel type="email" autoComplete="email" placeholder="contato@email.com" value={values.email} error={errors.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />
      <PasswordField label="Senha" hideLabel autoComplete="current-password" placeholder="Senha" value={values.password} error={errors.password} onChange={(e) => setValues({ ...values, password: e.target.value })} />
      <button type="button" className="self-end text-sm text-primary" onClick={() => notAvailable('A recuperação de senha')}>
        Esqueceu a senha?
      </button>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const register = useRegister()
  const [values, setValues] = useState({ username: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const set = (field: keyof typeof values) => (e: { target: { value: string } }) => setValues({ ...values, [field]: e.target.value })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next: FieldErrors = {}
    if (!/^[a-z0-9_.]{3,20}$/i.test(values.username)) next.username = 'Use 3 a 20 letras, números, "_" ou ".".'
    if (!EMAIL.test(values.email)) next.email = 'Informe um e-mail válido.'
    if (values.password.length < 8 || !/\d/.test(values.password) || !/[a-z]/i.test(values.password))
      next.password = 'A senha precisa de 8+ caracteres, com letras e números.'
    if (values.confirm !== values.password) next.confirm = 'As senhas não conferem.'
    setErrors(next)
    setFormError(undefined)
    if (Object.keys(next).length) return
    register.mutate(
      { username: values.username, email: values.email, password: values.password },
      {
        onSuccess: () => {
          toast.success('Conta criada com sucesso.')
          onDone()
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            setErrors(error.fields)
            setFormError(error.message)
          } else setFormError('Não foi possível criar a conta.')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <TextField label="Nome de usuário" hideLabel autoComplete="username" placeholder="Nome de usuário" value={values.username} error={errors.username} onChange={set('username')} />
      <TextField label="E-mail" hideLabel type="email" autoComplete="email" placeholder="Digite seu e-mail" value={values.email} error={errors.email} onChange={set('email')} />
      <PasswordField label="Senha" hideLabel autoComplete="new-password" placeholder="Senha" value={values.password} error={errors.password} onChange={set('password')} />
      <PasswordField label="Confirmar senha" hideLabel autoComplete="new-password" placeholder="Confirmar senha" value={values.confirm} error={errors.confirm} onChange={set('confirm')} />
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={register.isPending}>
        {register.isPending ? 'Criando…' : 'Criar conta'}
      </Button>
    </form>
  )
}
