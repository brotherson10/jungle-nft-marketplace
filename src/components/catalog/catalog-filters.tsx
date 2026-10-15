import { useState } from 'react'
import type { Category, Facets, Network, NftListParams } from '@/contracts/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { categories, categoryLabels, networkLabels, networks } from '@/lib/labels'

const PRICE_MIN = 0
const PRICE_MAX = 12.5

function toggle<T>(list: T[] | undefined, value: T): T[] | undefined {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value]
  return next.length ? next : undefined
}

/** Filtros combináveis; cada alteração vai para a URL e reinicia a paginação. */
export function CatalogFilters({
  search,
  facets,
  onChange,
}: {
  search: NftListParams
  facets?: Facets
  onChange: (patch: Partial<NftListParams>) => void
}) {
  const [range, setRange] = useState<number[]>([
    search.minPrice ? Number(search.minPrice) : PRICE_MIN,
    search.maxPrice ? Number(search.maxPrice) : PRICE_MAX,
  ])
  const format = (n: number) => n.toFixed(2).replace('.', ',')

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-bold">Coleções</legend>
        {categories.map((category: Category) => (
          <label key={category} className="flex cursor-pointer items-center gap-3 text-sm">
            <Checkbox
              checked={!!search.categories?.includes(category)}
              onCheckedChange={() => onChange({ categories: toggle(search.categories, category) })}
            />
            <span className="flex-1">{categoryLabels[category]}</span>
            <span className="text-muted-foreground">({facets?.categories[category] ?? 0})</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 font-bold">Faixa de preço</legend>
        <Slider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={0.01}
          value={range}
          onValueChange={setRange}
          minStepsBetweenThumbs={1}
          aria-label="Faixa de preço em ETH"
        />
        <p className="text-sm" aria-live="polite">
          Preço: {format(range[0] ?? PRICE_MIN)} - {format(range[1] ?? PRICE_MAX)} ETH
        </p>
        <Button
          size="sm"
          className="w-fit"
          onClick={() =>
            onChange({
              minPrice: range[0]! > PRICE_MIN ? range[0]!.toFixed(2) : undefined,
              maxPrice: range[1]! < PRICE_MAX ? range[1]!.toFixed(2) : undefined,
            })
          }
        >
          Aplicar
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-bold">Rede</legend>
        {networks.map((network: Network) => (
          <label key={network} className="flex cursor-pointer items-center gap-3 text-sm">
            <Checkbox
              checked={!!search.networks?.includes(network)}
              onCheckedChange={() => onChange({ networks: toggle(search.networks, network) })}
            />
            <span className="flex-1">{networkLabels[network]}</span>
            <span className="text-muted-foreground">({facets?.networks[network] ?? 0})</span>
          </label>
        ))}
      </fieldset>
    </div>
  )
}
