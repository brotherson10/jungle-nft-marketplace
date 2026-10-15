import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { orderApi } from '@/api/endpoints'
import { keys } from '@/api/queries'
import type { CreateOrderRequest, Order } from '@/contracts/api'
import { attemptFor, clearAttempt, getAttempt, saveAttempt } from '@/lib/checkout-attempt'

/**
 * Envia o pedido com chave de idempotência persistida. Falhas transitórias (timeout/rede/5xx)
 * são repetidas com a mesma chave; a simulação devolve o mesmo pedido sem duplicar.
 */
export function useCreateOrder(userId: string) {
  const queryClient = useQueryClient()
  return useMutation<Order, ApiError, CreateOrderRequest>({
    mutationFn: async (body) => {
      const attempt = attemptFor(userId, body)
      try {
        const order = await orderApi.create(attempt.body, attempt.key)
        saveAttempt(userId, { ...attempt, orderId: order.id })
        return order
      } catch (error) {
        // Erros definitivos encerram a tentativa; transitórios a preservam para retomada.
        if (error instanceof ApiError && !error.transient) clearAttempt(userId)
        throw error
      }
    },
    retry: (count, error) => error.transient && count < 2,
    retryDelay: 500,
    onSuccess: (order) => queryClient.setQueryData(keys.order(userId, order.id), order),
  })
}

/** Tentativa anterior não concluída (ex.: refresh após timeout) que pode ser retomada. */
export function pendingAttempt(userId: string) {
  return getAttempt(userId)
}
