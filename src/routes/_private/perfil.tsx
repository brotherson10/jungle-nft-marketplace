import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ImageIcon } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Profile, UpdateProfileRequest } from '@/contracts/api'
import { ApiError } from '@/api/client'
import { accountApi } from '@/api/endpoints'
import { keys, queries } from '@/api/queries'
import { AccountLayout } from '@/components/account/account-layout'
import { QueryError } from '@/components/feedback/query-error'
import { PasswordField, TextField, type FieldErrors } from '@/components/form/form-field'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getSession, setSession, useSession } from '@/lib/session'

export const Route = createFileRoute('/_private/perfil')({ component: ProfilePage })

const MAX_AVATAR_BYTES = 512 * 1024

function useProfileSync() {
  const queryClient = useQueryClient()
  const userId = useSession()!.user.id
  return (profile: Profile) => {
    queryClient.setQueryData(keys.profile(userId), profile)
    // Mantém o cabeçalho coerente com os dados confirmados pela API.
    const session = getSession()
    if (session) setSession({ ...session, user: { ...session.user, displayName: profile.displayName, username: profile.username, email: profile.email, avatarUrl: profile.avatarUrl } })
  }
}

function ProfilePage() {
  const userId = useSession()!.user.id
  const profile = useQuery(queries.profile(userId))
  return (
    <AccountLayout title="Perfil do colecionador">
      {profile.data ? (
        <>
          <ProfileForm key={profile.data.id} profile={profile.data} />
          <AvatarForm profile={profile.data} />
          <PasswordForm />
        </>
      ) : profile.isError ? (
        <QueryError error={profile.error} onRetry={() => void profile.refetch()} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}
    </AccountLayout>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const sync = useProfileSync()
  const [values, setValues] = useState<UpdateProfileRequest>({ displayName: profile.displayName, username: profile.username, email: profile.email, bio: profile.bio })
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = useMutation({ mutationFn: accountApi.updateProfile })
  const set = (field: keyof UpdateProfileRequest) => (e: { target: { value: string } }) => setValues({ ...values, [field]: e.target.value })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next: FieldErrors = {}
    if (values.displayName.trim().length < 2) next.displayName = 'Informe o nome de exibição.'
    if (!/^[a-z0-9_.]{3,20}$/i.test(values.username)) next.username = 'Use 3 a 20 letras, números, "_" ou ".".'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Informe um e-mail válido.'
    setErrors(next)
    if (Object.keys(next).length) return
    save.mutate(values, {
      onSuccess: (updated) => {
        sync(updated)
        toast.success('Perfil atualizado.')
      },
      onError: (error) => {
        if (error instanceof ApiError) setErrors(error.fields)
        toast.error(error instanceof ApiError ? error.message : 'Não foi possível salvar o perfil.')
      },
    })
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 md:grid-cols-2" aria-label="Dados do perfil">
      <TextField label="Nome de exibição" required value={values.displayName} error={errors.displayName} onChange={set('displayName')} autoComplete="name" />
      <TextField label="Nome de usuário" required value={values.username} error={errors.username} onChange={set('username')} autoComplete="username" />
      <TextField label="E-mail" required type="email" value={values.email} error={errors.email} onChange={set('email')} autoComplete="email" />
      <TextField label="Bio" value={values.bio} error={errors.bio} onChange={set('bio')} maxLength={280} />
      <Button type="submit" disabled={save.isPending} className="w-fit px-10">
        {save.isPending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function AvatarForm({ profile }: { profile: Profile }) {
  const sync = useProfileSync()
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string>()
  const onSuccess = (updated: Profile) => {
    sync(updated)
    setError(undefined)
    toast.success('Avatar atualizado.')
  }
  const onError = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Não foi possível atualizar o avatar.')
  const upload = useMutation({ mutationFn: accountApi.updateAvatar, onSuccess, onError })
  const remove = useMutation({ mutationFn: accountApi.removeAvatar, onSuccess, onError })

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('Envie uma imagem PNG, JPEG ou WebP.')
    if (file.size > MAX_AVATAR_BYTES) return setError('A imagem deve ter até 512 KB.')
    const reader = new FileReader()
    reader.onload = () => upload.mutate(String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <section aria-labelledby={`${inputId}-title`} className="flex flex-col gap-3">
      <h2 id={`${inputId}-title`} className="text-sm">
        Avatar
      </h2>
      <div className="flex items-center gap-5">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="Seu avatar" className="size-12 rounded-full object-cover" data-testid="avatar-image" />
        ) : (
          <span role="img" className="grid size-12 place-items-center rounded-full border border-border bg-card" aria-label="Sem avatar">
            <ImageIcon className="size-5 text-primary" aria-hidden="true" />
          </span>
        )}
        <input ref={input} id={inputId} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-describedby={error ? `${inputId}-error` : undefined} onChange={(e) => onFile(e.target.files?.[0])} />
        <Button type="button" onClick={() => input.current?.click()} disabled={upload.isPending}>
          Alterar <span className="sr-only">avatar</span>
        </Button>
        <Button type="button" variant="ghost" onClick={() => remove.mutate()} disabled={!profile.avatarUrl || remove.isPending}>
          Remover <span className="sr-only">avatar</span>
        </Button>
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

function PasswordForm() {
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const change = useMutation({ mutationFn: accountApi.changePassword })
  const set = (field: keyof typeof values) => (e: { target: { value: string } }) => setValues({ ...values, [field]: e.target.value })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next: FieldErrors = {}
    if (!values.currentPassword) next.currentPassword = 'Informe a senha atual.'
    if (values.newPassword.length < 8 || !/\d/.test(values.newPassword) || !/[a-z]/i.test(values.newPassword))
      next.newPassword = 'A senha precisa de 8+ caracteres, com letras e números.'
    if (values.confirm !== values.newPassword) next.confirm = 'As senhas não conferem.'
    setErrors(next)
    if (Object.keys(next).length) return
    change.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          setValues({ currentPassword: '', newPassword: '', confirm: '' })
          toast.success('Senha alterada.')
        },
        onError: (error) => {
          if (error instanceof ApiError) setErrors(error.fields)
          toast.error(error instanceof ApiError ? error.message : 'Não foi possível alterar a senha.')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-5" aria-labelledby="password-title">
      <h2 id="password-title" className="font-bold">
        Alterar senha
      </h2>
      <PasswordField label="Senha atual" autoComplete="current-password" value={values.currentPassword} error={errors.currentPassword} onChange={set('currentPassword')} />
      <PasswordField label="Nova senha" autoComplete="new-password" value={values.newPassword} error={errors.newPassword} onChange={set('newPassword')} />
      <PasswordField label="Confirmar nova senha" autoComplete="new-password" value={values.confirm} error={errors.confirm} onChange={set('confirm')} />
      <Button type="submit" disabled={change.isPending} className="w-fit px-10">
        Alterar senha
      </Button>
    </form>
  )
}
