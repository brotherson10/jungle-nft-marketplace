import { toast } from 'sonner'

/** Ações fora do escopo da demonstração: informam claramente, sem simular sucesso. */
export function notAvailable(feature: string) {
  toast.info(`${feature} não está disponível nesta demonstração.`)
}
