import axios, { AxiosError } from 'axios'
import type { ApiErrorBody, ErrorCode, Quote } from '@/contracts/api'
import { getGuestId, getSession, setSession } from '@/lib/session'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK' | 'TIMEOUT' | 'CANCELED',
    message: string,
    readonly fields: Record<string, string> = {},
    readonly quote?: Quote,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Falhas transitórias que podem ser repetidas com segurança. */
  get transient(): boolean {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.status >= 500
  }
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10_000,
  // Arrays como parâmetros repetidos: ?category=a&category=b
  paramsSerializer: { indexes: null },
})

http.interceptors.request.use((config) => {
  const token = getSession()?.token
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Guest-Id', getGuestId())
  return config
})

http.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isCancel(error)) throw new ApiError(0, 'CANCELED', 'Requisição cancelada.')
  if (!(error instanceof AxiosError)) throw error
  if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT)
    throw new ApiError(0, 'TIMEOUT', 'A resposta demorou demais. Tente novamente.')
  if (!error.response) throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor.')

  const body = error.response.data as Partial<ApiErrorBody> | undefined
  const code = body?.code ?? 'UNAVAILABLE'
  // Sessão inválida/expirada: descarta a sessão local; rotas privadas redirecionam para o login.
  if (error.response.status === 401 && (code === 'SESSION_EXPIRED' || code === 'UNAUTHENTICATED') && getSession())
    setSession(null, 'expired')
  throw new ApiError(error.response.status, code, body?.message ?? 'Erro inesperado.', body?.fields, body?.quote)
})
