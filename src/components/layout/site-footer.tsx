import { Link } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { categoryLabels } from '@/lib/labels'
import { notAvailable } from '@/lib/out-of-scope'

const features = [
  ['W', 'Segurança da carteira', 'Proteja sua carteira e colecione arte digital verificada com confiança.'],
  ['C', 'Criadores em destaque', 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.'],
  ['D', 'Alertas de lançamentos', 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.'],
] as const

const social = [
  ['Facebook', 'https://www.facebook.com', 'f'],
  ['Instagram', 'https://www.instagram.com', 'ig'],
  ['X (Twitter)', 'https://x.com', 'x'],
  ['LinkedIn', 'https://www.linkedin.com', 'in'],
  ['YouTube', 'https://www.youtube.com', 'yt'],
] as const

export function SiteFooter() {
  const emailId = useId()
  const [email, setEmail] = useState('')
  return (
    <footer className="mx-auto mt-20 hidden max-w-[1200px] px-6 pb-6 md:block">
      <div className="grid gap-8 rounded-t-lg bg-card p-8 lg:grid-cols-4">
        {features.map(([letter, title, text]) => (
          <div key={title} className="flex flex-col gap-3 border-primary lg:border-r lg:pr-6">
            <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
              {letter}
            </span>
            <h2 className="font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            notAvailable('A inscrição na newsletter')
          }}
        >
          <h2 className="font-bold">Antecipe-se ao próximo lançamento</h2>
          <label htmlFor={emailId} className="sr-only">
            E-mail para novidades
          </label>
          <div className="flex">
            <Input id={emailId} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="digite seu e-mail..." className="rounded-r-none bg-secondary" />
            <Button type="submit" className="h-10 rounded-l-none">
              Enviar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
        </form>
      </div>
      <div className="grid gap-4 bg-band px-8 py-6 text-sm sm:grid-cols-4">
        <span className="font-bold tracking-widest">KURIO</span>
        <span>Feito para colecionadores, criadores e cultura</span>
        <span>contato@email.com</span>
        <span>+55 11 4002 8922</span>
      </div>
      <div className="grid gap-8 rounded-b-lg bg-card p-8 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <h2 className="mb-1 text-base font-bold">Meu perfil</h2>
          <Link to="/perfil" className="hover:text-primary">Meu perfil</Link>
          <Link to="/carteiras" className="hover:text-primary">Carteiras</Link>
          <Link to="/" search={{ favorites: true }} className="hover:text-primary">Lista de interesse</Link>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="mb-1 text-base font-bold">Central de ajuda</h2>
          {['Central de ajuda', 'Como comprar NFTs', 'Política do mercado'].map((label) => (
            <button key={label} type="button" className="text-left hover:text-primary" onClick={() => notAvailable(label)}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="mb-1 text-base font-bold">Coleções</h2>
          {(['arte-digital', 'fotografia', 'musica', 'arte-3d', 'utilidade'] as const).map((category) => (
            <Link key={category} to="/" search={{ categories: [category] }} hash="catalogo" className="hover:text-primary">
              {categoryLabels[category]}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold">Redes sociais</h2>
          <ul className="flex gap-2">
            {social.map(([name, href, short]) => (
              <li key={name}>
                <a href={href} target="_blank" rel="noreferrer noopener" aria-label={`${name} (abre em nova aba)`} className="grid size-8 place-items-center rounded-sm border border-primary text-xs font-bold text-primary">
                  {short}
                </a>
              </li>
            ))}
          </ul>
          <h2 className="text-base font-bold">Carteiras compatíveis</h2>
          <p className="w-fit rounded-sm border border-primary px-2 py-1 text-[10px] font-bold text-primary">METAMASK · WALLETCONNECT · COINBASE</p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
