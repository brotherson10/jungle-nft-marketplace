import type { Eth } from '@/contracts/api'

/** Aritmética de ETH em wei (bigint, 18 casas) para evitar erros de ponto flutuante. */
const DECIMALS = 18
const SCALE = 10n ** BigInt(DECIMALS)
const PATTERN = /^\d+(\.\d{1,18})?$/

export function isEth(value: string): boolean {
  return PATTERN.test(value)
}

export function toWei(value: Eth): bigint {
  if (!isEth(value)) throw new Error(`Valor ETH inválido: "${value}"`)
  const [int = '0', frac = ''] = value.split('.')
  return BigInt(int) * SCALE + BigInt(frac.padEnd(DECIMALS, '0'))
}

export function fromWei(wei: bigint): Eth {
  const sign = wei < 0n ? '-' : ''
  const abs = wei < 0n ? -wei : wei
  const int = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return `${sign}${int}${frac ? `.${frac}` : ''}`
}

export const addEth = (...values: Eth[]): Eth => fromWei(values.reduce((sum, v) => sum + toWei(v), 0n))
export const subEth = (a: Eth, b: Eth): Eth => fromWei(toWei(a) - toWei(b))
export const mulEth = (value: Eth, quantity: number): Eth => fromWei(toWei(value) * BigInt(quantity))
export const cmpEth = (a: Eth, b: Eth): number => Math.sign(Number(toWei(a) - toWei(b)))

/** Percentual em basis points, arredondado para baixo no wei. */
export const bpsOf = (value: Eth, bps: number): Eth => fromWei((toWei(value) * BigInt(bps)) / 10000n)

/** Formatação para exibição: mínimo de 2 casas, sem perder precisão. */
export function formatEth(value: Eth): string {
  const [int, frac = ''] = fromWei(toWei(value)).split('.')
  return `${int}.${frac.padEnd(2, '0')} ETH`
}
