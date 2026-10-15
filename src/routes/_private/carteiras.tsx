import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Network, Wallet, WalletInput, WalletSlot, WalletType } from '@/contracts/api'
import { ApiError } from '@/api/client'
import { accountApi } from '@/api/endpoints'
import { keys, queries } from '@/api/queries'
import { AccountLayout } from '@/components/account/account-layout'
import { QueryError } from '@/components/feedback/query-error'
import { Field, TextField, type FieldErrors } from '@/components/form/form-field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { networkLabels, networks, walletLabels, walletTypes } from '@/lib/labels'
import { useSession } from '@/lib/session'

export const Route = createFileRoute('/_private/carteiras')({ component: WalletsPage })

const empty: WalletInput = {
  displayName: '',
  nickname: '',
  network: '' as Network,
  profileName: '',
  address: '',
  secondaryAddress: '',
  type: '' as WalletType,
  referralCode: '',
  email: '',
  ensName: '',
}

const toInput = (wallet: Wallet | null): WalletInput => {
  if (!wallet) return empty
  const { slot: _slot, updatedAt: _updatedAt, ...input } = wallet
  return input
}

/** Mesmas regras da API, para feedback imediato; a API continua sendo a validação final. */
function validate(v: WalletInput): FieldErrors {
  const errors: FieldErrors = {}
  if (!v.displayName.trim()) errors.displayName = 'Obrigatório.'
  if (!v.nickname.trim()) errors.nickname = 'Obrigatório.'
  if (!v.network) errors.network = 'Selecione uma rede.'
  if (!v.profileName.trim()) errors.profileName = 'Obrigatório.'
  if (!/^0x[a-fA-F0-9]{40}$/.test(v.address.trim())) errors.address = 'Endereço 0x com 40 caracteres hexadecimais.'
  if (v.secondaryAddress && !/^0x[a-fA-F0-9]{40}$/.test(v.secondaryAddress) && !v.secondaryAddress.endsWith('.eth'))
    errors.secondaryAddress = 'Use um endereço 0x ou nome ENS.'
  if (!v.type) errors.type = 'Selecione uma carteira.'
  if (!v.referralCode.trim()) errors.referralCode = 'Obrigatório.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = 'Informe um e-mail válido.'
  if (!/^[a-z0-9-]{3,}$/.test(v.ensName.toLowerCase())) errors.ensName = 'Mínimo de 3 letras, números ou "-".'
  return errors
}

function WalletsPage() {
  const userId = useSession()!.user.id
  const wallets = useQuery(queries.wallets(userId))
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  return (
    <AccountLayout title="Carteiras">
      {wallets.data ? (
        <>
          <section aria-labelledby="primary-title" className="flex flex-col gap-6">
            <div>
              <h2 id="primary-title" className="font-bold">
                Carteira principal
              </h2>
              <p className="text-sm text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
            </div>
            <WalletForm slot="primary" initial={toInput(wallets.data.primary)} />
          </section>
          <section aria-labelledby="secondary-title" className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="secondary-title" className="font-bold">
                  Carteira secundária
                </h2>
                {!wallets.data.secondary && !addingSecondary && <p className="text-sm text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox checked={sameAsPrimary} disabled={!wallets.data.primary} onCheckedChange={(v) => { setSameAsPrimary(v === true); setAddingSecondary(true) }} />
                  Igual à carteira principal
                </label>
                {!wallets.data.secondary && !addingSecondary && (
                  <Button variant="link" onClick={() => setAddingSecondary(true)}>
                    Adicionar
                  </Button>
                )}
              </div>
            </div>
            {(wallets.data.secondary || addingSecondary) && (
              <WalletForm
                key={sameAsPrimary ? 'copy' : 'own'}
                slot="secondary"
                initial={sameAsPrimary ? { ...toInput(wallets.data.primary), nickname: 'Reserva' } : toInput(wallets.data.secondary)}
              />
            )}
          </section>
        </>
      ) : wallets.isError ? (
        <QueryError error={wallets.error} onRetry={() => void wallets.refetch()} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}
    </AccountLayout>
  )
}

function WalletForm({ slot, initial }: { slot: WalletSlot; initial: WalletInput }) {
  const queryClient = useQueryClient()
  const userId = useSession()!.user.id
  const id = useId()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const save = useMutation({ mutationFn: (input: WalletInput) => accountApi.saveWallet(slot, input) })
  const set = (field: keyof WalletInput) => (e: { target: { value: string } }) => setValues({ ...values, [field]: e.target.value })
  const label = slot === 'primary' ? 'principal' : 'secundária'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = validate(values)
    setErrors(next)
    if (Object.keys(next).length) return toast.error('Revise os campos destacados.')
    save.mutate(values, {
      onSuccess: (wallets) => {
        queryClient.setQueryData(keys.wallets(userId), wallets)
        void queryClient.invalidateQueries({ queryKey: keys.walletConnection(userId) })
        toast.success(`Carteira ${label} salva.`)
      },
      onError: (error) => {
        if (error instanceof ApiError) setErrors(error.fields)
        toast.error(error instanceof ApiError ? error.message : 'Não foi possível salvar a carteira.')
      },
    })
  }

  return (
    <form onSubmit={submit} noValidate aria-label={`Carteira ${label}`} className="grid gap-6 md:grid-cols-2">
      <TextField label="Nome de exibição" required value={values.displayName} error={errors.displayName} onChange={set('displayName')} />
      <TextField label="Apelido da carteira" required value={values.nickname} error={errors.nickname} onChange={set('nickname')} />
      <Field label="Rede" required error={errors.network}>
        {(a11y) => (
          <Select value={values.network || undefined} onValueChange={(v) => setValues({ ...values, network: v as Network })}>
            <SelectTrigger {...a11y} className="h-10 w-full">
              <SelectValue placeholder="Selecione uma rede" />
            </SelectTrigger>
            <SelectContent>
              {networks.map((n) => (
                <SelectItem key={n} value={n}>
                  {networkLabels[n]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <TextField label="Nome do perfil" required value={values.profileName} error={errors.profileName} onChange={set('profileName')} />
      <TextField label="Endereço da carteira" required placeholder="Endereço 0x da carteira" value={values.address} error={errors.address} onChange={set('address')} spellCheck={false} />
      <TextField label="ENS ou carteira secundária (opcional)" placeholder="ENS ou carteira secundária (opcional)" value={values.secondaryAddress} error={errors.secondaryAddress} onChange={set('secondaryAddress')} spellCheck={false} />
      <Field label="Tipo de carteira" required error={errors.type}>
        {(a11y) => (
          <Select value={values.type || undefined} onValueChange={(v) => setValues({ ...values, type: v as WalletType })}>
            <SelectTrigger {...a11y} className="h-10 w-full">
              <SelectValue placeholder="Selecione uma carteira" />
            </SelectTrigger>
            <SelectContent>
              {walletTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {walletLabels[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <TextField label="Código de indicação" required value={values.referralCode} error={errors.referralCode} onChange={set('referralCode')} />
      <TextField label="E-mail" required type="email" value={values.email} error={errors.email} onChange={set('email')} />
      <Field label="Nome ENS" required error={errors.ensName}>
        {(a11y) => (
          <div className="flex items-center gap-2">
            <Input {...a11y} id={a11y.id} value={values.ensName} onChange={set('ensName')} spellCheck={false} />
            <span className="rounded-sm border border-border px-3 py-2 text-sm" id={`${id}-suffix`}>
              .eth
            </span>
          </div>
        )}
      </Field>
      <Button type="submit" disabled={save.isPending} className="w-fit">
        {save.isPending ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}
