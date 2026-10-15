import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Favorites } from '@/contracts/api'
import { favoritesApi } from '@/api/endpoints'
import { keys, queries } from '@/api/queries'
import { useSession } from '@/lib/session'

export function useFavorites() {
  const userId = useSession()?.user.id
  return useQuery({ ...queries.favorites(userId ?? ''), enabled: !!userId })
}

/** Atualização otimista com rollback em caso de falha. */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const userId = useSession()?.user.id ?? ''
  const key = keys.favorites(userId)

  return useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Favorites>(key)
      const ids = previous?.nftIds ?? []
      queryClient.setQueryData<Favorites>(key, {
        nftIds: favorite ? [...new Set([...ids, nftId])] : ids.filter((id) => id !== nftId),
      })
      return { previous }
    },
    onError: (_error, { favorite }, context) => {
      queryClient.setQueryData(key, context?.previous)
      toast.error(favorite ? 'Não foi possível favoritar. Tente novamente.' : 'Não foi possível remover dos favoritos.')
    },
    onSuccess: (_data, { favorite }) => toast.success(favorite ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
