import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddCartItemRequest, Cart, Network } from '@/contracts/api'
import { cartApi } from '@/api/endpoints'
import { keys, queries } from '@/api/queries'
import { useSession } from '@/lib/session'

/** Dono do carrinho no cache: usuário autenticado ou visitante. */
export function useCartOwner() {
  return useSession()?.user.id ?? 'guest'
}

export function useCart(network?: Network) {
  return useQuery(queries.cart(useCartOwner(), network))
}

export function useCartCount() {
  const { data } = useCart()
  return data?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0
}

/** Mutations do carrinho: a resposta da API é a fonte da verdade para itens e cotação. */
export function useCartMutations() {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  const onSuccess = (cart: Cart) => {
    queryClient.setQueryData(keys.cart(owner), cart)
    // Cotações em outras redes (checkout) precisam ser recalculadas.
    void queryClient.invalidateQueries({ queryKey: ['cart', owner], predicate: (q) => q.queryKey[2] !== 'ethereum' })
  }
  return {
    add: useMutation({ mutationFn: (body: AddCartItemRequest) => cartApi.add(body), onSuccess }),
    update: useMutation({ mutationFn: (v: { lineId: string; quantity: number }) => cartApi.update(v.lineId, v.quantity), onSuccess }),
    remove: useMutation({ mutationFn: (lineId: string) => cartApi.remove(lineId), onSuccess }),
    applyCoupon: useMutation({ mutationFn: (code: string) => cartApi.applyCoupon(code), onSuccess }),
    removeCoupon: useMutation({ mutationFn: () => cartApi.removeCoupon(), onSuccess }),
    acceptPrices: useMutation({ mutationFn: () => cartApi.acceptPrices(), onSuccess }),
  }
}
