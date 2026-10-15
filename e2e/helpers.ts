import { expect, type Page } from '@playwright/test'

export const ANA = { email: 'ana@kurio.test', password: 'Kurio@123' }
export const BRUNO = { email: 'bruno@kurio.test', password: 'Kurio@456' }

/** Estado isolado: seed restaurado + cenário; espera MSW e Socket.IO ativos. */
export async function open(page: Page, path: string, scenario = 'fast') {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}__reset=1&__scenario=${scenario}`)
  // Primeiro carregamento inclui o boot do MSW (e, no dev server, a compilação sob demanda).
  await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real: connected', { timeout: 30_000 })
}

export async function expectRealtime(page: Page) {
  await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real: connected')
}

/**
 * Chamada à API simulada de dentro da página (passa pelo MSW), com a sessão atual.
 * Usada para controle de cenário e verificações de estado, nunca para executar o fluxo da UI.
 */
export function api(page: Page, method: string, path: string, body?: unknown) {
  return page.evaluate(
    async ({ method, path, body }) => {
      const session = JSON.parse(localStorage.getItem('kurio.session') ?? 'null')
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Guest-Id': localStorage.getItem('kurio.guestId') ?? '' }
      if (session) headers.Authorization = `Bearer ${session.token}`
      const response = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
      const text = await response.text()
      return { status: response.status, data: text ? JSON.parse(text) : null }
    },
    { method, path, body },
  )
}

/** Login pelo diálogo (já aberto via /entrar). */
export async function fillLogin(page: Page, { email, password }: { email: string; password: string }) {
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('E-mail').fill(email)
  await dialog.getByLabel('Senha', { exact: true }).fill(password)
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(dialog).toBeHidden()
}

export async function loginAt(page: Page, user: { email: string; password: string }, redirect = '/') {
  await page.goto(`/entrar?redirect=${encodeURIComponent(redirect)}`)
  await fillLogin(page, user)
  await expect(page).toHaveURL(new RegExp(`${redirect.replace(/[?]/g, '\\?')}$`))
}

/** Adiciona um NFT ao carrinho pela tela de detalhe. */
export async function addToCart(page: Page, nftId: string, quantity = 1) {
  await page.goto(`/nft/${nftId}`)
  for (let i = 1; i < quantity; i++) await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: 'COMPRAR', exact: true }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
}

/** No pagamento: conecta a carteira, revisa e confirma. */
export async function connectAndReview(page: Page) {
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(page.getByTestId('order-review')).toBeVisible()
}

/** Conta requisições REST de detalhe de pedido (para provar atualização via socket). */
export function countOrderFetches(page: Page) {
  const calls: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'GET' && /\/api\/orders\/ord-/.test(new URL(request.url()).pathname)) calls.push(request.url())
  })
  return calls
}
