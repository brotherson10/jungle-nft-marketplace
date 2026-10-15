import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/endpoints'
import { setSession } from '@/lib/session'

export function useLogin() {
  return useMutation({ mutationFn: authApi.login, onSuccess: (session) => setSession(session) })
}

export function useRegister() {
  return useMutation({ mutationFn: authApi.register, onSuccess: (session) => setSession(session) })
}

/** Logout: cancela consultas em andamento antes de trocar a sessão (caches privados são limpos no SessionEffects). */
export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await queryClient.cancelQueries()
      try {
        await authApi.logout()
      } finally {
        setSession(null)
      }
    },
  })
}
