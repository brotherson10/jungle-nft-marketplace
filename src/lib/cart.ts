import type { Cart } from '@/contracts/api'
import { cmpEth } from './eth'

/** Linhas cujo preço mudou desde a última confirmação do usuário. */
export const changedLines = (cart: Cart) => cart.lines.filter((l) => cmpEth(l.unitPrice, l.previousUnitPrice) !== 0)
