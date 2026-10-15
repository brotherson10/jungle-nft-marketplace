import type { Category, Edition, Eth, Network, Nft } from '@/contracts/api'
import { bpsOf, fromWei, mulEth, toWei } from '@/lib/eth'

/** Credenciais fictícias. Senhas guardadas como SHA-256(salt:senha). */
export const seedUsers = [
  {
    id: 'u-ana',
    username: 'ana',
    email: 'ana@kurio.test',
    displayName: 'Ana Colecionadora',
    avatarUrl: null,
    bio: '',
    salt: 's-ana',
    passwordHash: 'ac9c83ed822e992875bb16b590b564955dabf6403fd27d4479370b178282e879', // Kurio@123
  },
  {
    id: 'u-bruno',
    username: 'bruno',
    email: 'bruno@kurio.test',
    displayName: 'Bruno Curador',
    avatarUrl: null,
    bio: '',
    salt: 's-bruno',
    passwordHash: '6f745e451d2593c8226f50796cc746f46c58a02a8b365f85e46a632b5cf63217', // Kurio@456
  },
]

export const coupons: Record<string, { label: string; bps?: number; fixed?: Eth; expired?: boolean }> = {
  KURIO10: { label: 'Desconto do lançamento (10%)', bps: 1000 },
  GENESIS: { label: 'Desconto do lançamento', fixed: '0.05' },
  VERAO2025: { label: 'Cupom de verão', bps: 1500, expired: true },
}

export const networkFees: Record<Network, Eth> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

// Arquétipos visuais do Figma; os arquivos de imagem ainda dependem dos exports de assets.
const archetypes = ['emerald', 'sage', 'ivory', 'golden'] as const
const categories: Category[] = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
]
const networks: Network[] = ['ethereum', 'polygon', 'solana']

const named: { name: string; archetype: (typeof archetypes)[number]; price: Eth; compareAt?: Eth }[] = [
  { name: 'Emerald Ape #042', archetype: 'emerald', price: '1.19' },
  { name: 'Sage Nomad #009', archetype: 'sage', price: '1.69' },
  { name: 'Neon Vessel #552', archetype: 'emerald', price: '1.99', compareAt: '2.29' },
  { name: 'Cosmic Bloom #118', archetype: 'sage', price: '1.29' },
  { name: 'Violet Nomad #314', archetype: 'sage', price: '1.39' },
  { name: 'Ivory Baron #088', archetype: 'ivory', price: '1.79' },
  { name: 'Golden Beat #207', archetype: 'golden', price: '0.99' },
  { name: 'Golden Frequency #071', archetype: 'golden', price: '0.59' },
  { name: 'Golden Signal #160', archetype: 'golden', price: '0.39' },
]
const words = ['Amber', 'Onyx', 'Jade', 'Coral', 'Lunar', 'Rust', 'Velvet', 'Copper', 'Mist', 'Ember', 'Cedar', 'Quartz']
const kinds = ['Ape', 'Nomad', 'Baron', 'Beat', 'Bloom', 'Signal']

function editionsFor(id: string, price: Eth, index: number): Edition[] {
  return [
    // Algumas edições 1/1 já vendidas para exercitar "edição indisponível".
    { id: '1-1', label: '1/1', price: mulEth(price, 4), available: index % 4 === 0 ? 0 : 1, maxPerOrder: 1 },
    { id: '1-10', label: '1/10', price: mulEth(price, 2), available: 10, maxPerOrder: 3 },
    { id: '1-50', label: '1/50', price, available: 50 - (index % 7), maxPerOrder: 10 },
    { id: 'aberta', label: 'ABERTA', price: bpsOf(price, 5000), available: 999, maxPerOrder: 10 },
  ].map((e) => ({ ...e, id: `${id}-${e.id}` }))
}

function buildNft(index: number, name: string, archetype: string, price: Eth, compareAt?: Eth): Nft {
  const id = `nft-${String(index + 1).padStart(3, '0')}`
  const tokenId = `#${name.split('#')[1] ?? String(index).padStart(3, '0')}`
  const image = `/images/nfts/${archetype}.webp`
  return {
    id,
    name,
    tokenId,
    image,
    images: [image, image, image, image],
    price,
    compareAtPrice: compareAt ?? null,
    badge: compareAt ? 'raro' : null,
    category: categories[index % categories.length]!,
    network: networks[index % networks.length]!,
    version: 1,
    description: `Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na rede, com arte desbloqueável e acesso para colecionadores.`,
    details: `${name} é uma obra digital da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token.`,
    collection: `Kurio ${archetype[0]!.toUpperCase()}${archetype.slice(1)}s`,
    creator: 'Nova Sato',
    attributes: ['Óculos', 'Esmeralda', 'Raro'].slice(0, 1 + (index % 3)),
    editions: editionsFor(id, price, index),
    rating: 3 + (index % 3),
    reviewCount: 5 + ((index * 7) % 30),
    contractAddress: '0x7A42c0ffee00000000000000000000000019E8',
    royaltyBps: 500,
  }
}

/** Catálogo determinístico: 9 NFTs do layout (listados mais recentemente) + variações para filtros e paginação. */
export function buildCatalog(): Nft[] {
  const nfts = named.map((n, i) => buildNft(i, n.name, n.archetype, n.price, n.compareAt))
  for (let i = named.length; i < 48; i++) {
    const name = `${words[i % words.length]} ${kinds[i % kinds.length]} #${String(100 + i * 7).padStart(3, '0')}`
    // Preços entre 0.02 e 12.30 ETH, como a faixa do layout.
    const price = fromWei(toWei('0.02') + toWei('0.25') * BigInt((i * 17) % 48))
    nfts.push(buildNft(i, name, archetypes[i % archetypes.length]!, price))
  }
  return nfts
}
