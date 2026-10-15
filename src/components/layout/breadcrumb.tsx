import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'

export function Breadcrumb({ current, items = [] }: { current: string; items?: { label: string; to: '/' | '/carrinho' }[] }) {
  const trail = [{ label: 'Início', to: '/' as const }, { label: 'Mercado', to: '/' as const }, ...items]
  return (
    <nav aria-label="Trilha de navegação" className="hidden py-6 text-sm font-semibold md:block">
      <ol className="flex flex-wrap gap-2">
        {trail.map((item) => (
          <Fragment key={item.label}>
            <li>
              <Link to={item.to} className="hover:text-primary">
                {item.label}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
          </Fragment>
        ))}
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  )
}
