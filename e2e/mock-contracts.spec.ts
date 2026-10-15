import { expect, test, type Page } from '@playwright/test'

/** Chamada REST de dentro da página: passa pelo service worker e pelos handlers MSW. */
function api(page: Page, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return page.evaluate(
    async ({ method, path, body, headers }) => {
      const response = await fetch(`/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Guest-Id': 'guest-e2e', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const text = await response.text()
      return { status: response.status, data: text ? JSON.parse(text) : null }
    },
    { method, path, body, headers },
  )
}

/** A aplicação só renderiza depois de o MSW estar ativo. */
async function openWithMocks(page: Page) {
  await page.goto('/?__reset=1&__scenario=fast')
  await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real: connected', { timeout: 30_000 })
}

async function login(page: Page, email: string, password: string) {
  const { status, data } = await api(page, 'POST', '/auth/login', { email, password })
  expect(status).toBe(200)
  return { Authorization: `Bearer ${data.token}` }
}

test('pedido idempotente, snapshot imutável e isolamento entre usuários', async ({ page }) => {
  await openWithMocks(page)

  // Carrinho de visitante é preservado no login.
  await api(page, 'POST', '/cart/items', { nftId: 'nft-001', editionId: 'nft-001-1-50', quantity: 2 })
  const ana = await login(page, 'ana@kurio.test', 'Kurio@123')
  const cart = await api(page, 'GET', '/cart', undefined, ana)
  expect(cart.data.lines).toHaveLength(1)
  expect(cart.data.quote).toMatchObject({ subtotal: '2.38', networkFee: '0.016', total: '2.396' })

  // Cupom inválido e expirado.
  expect((await api(page, 'PUT', '/cart/coupon', { code: 'NAOEXISTE' }, ana)).data.code).toBe('COUPON_INVALID')
  expect((await api(page, 'PUT', '/cart/coupon', { code: 'VERAO2025' }, ana)).data.code).toBe('COUPON_EXPIRED')

  const order = {
    quoteId: cart.data.quote.id,
    walletSlot: 'primary',
    provider: 'metamask',
    network: 'ethereum',
    collector: { displayName: 'Ana', username: 'ana', email: 'ana@kurio.test' },
    note: '',
  }
  // Sem conexão de carteira o pedido é rejeitado.
  const disconnected = await api(page, 'POST', '/orders', order, { ...ana, 'Idempotency-Key': 'key-0' })
  expect(disconnected.data.code).toBe('WALLET_DISCONNECTED')
  expect((await api(page, 'POST', '/wallets/connect', { slot: 'primary', provider: 'metamask' }, ana)).status).toBe(200)
  const key = { ...ana, 'Idempotency-Key': 'key-1' }
  const first = await api(page, 'POST', '/orders', order, key)
  expect(first.status).toBe(201)
  expect(first.data.status).toBe('pending')

  // Mesma tentativa recupera o mesmo pedido; mesma chave com outro conteúdo gera conflito.
  const retry = await api(page, 'POST', '/orders', order, key)
  expect(retry.data.id).toBe(first.data.id)
  const conflict = await api(page, 'POST', '/orders', { ...order, note: 'outro' }, key)
  expect(conflict.data.code).toBe('IDEMPOTENCY_CONFLICT')

  // Outro usuário não enxerga o pedido.
  const bruno = await login(page, 'bruno@kurio.test', 'Kurio@456')
  expect((await api(page, 'GET', `/orders/${first.data.id}`, undefined, bruno)).status).toBe(404)

  // Confirmação simulada; alteração posterior do catálogo não muda o recibo.
  await expect
    .poll(async () => (await api(page, 'GET', `/orders/${first.data.id}`, undefined, ana)).data.status)
    .toBe('confirmed')
  await api(page, 'POST', '/__mock/nfts/nft-001', { editions: [{ id: 'nft-001-1-50', price: '9.99' }] })
  const receipt = await api(page, 'GET', `/orders/${first.data.id}`, undefined, ana)
  expect(receipt.data).toMatchObject({ total: '2.396', lines: [{ unitPrice: '1.19', quantity: 2 }] })
  expect(receipt.data.transactionHash).toMatch(/^0x[0-9a-f]{64}$/)

  // Itens comprados saem do carrinho.
  expect((await api(page, 'GET', '/cart', undefined, ana)).data.lines).toHaveLength(0)
})

test('cotação desatualizada impede a confirmação', async ({ page }) => {
  await openWithMocks(page)
  const ana = await login(page, 'ana@kurio.test', 'Kurio@123')
  await api(page, 'POST', '/cart/items', { nftId: 'nft-002', editionId: 'nft-002-1-50', quantity: 1 }, ana)
  const { data: cart } = await api(page, 'GET', '/cart', undefined, ana)
  await api(page, 'POST', '/wallets/connect', { slot: 'primary', provider: 'metamask' }, ana)

  await api(page, 'POST', '/__mock/nfts/nft-002', { editions: [{ id: 'nft-002-1-50', price: '2.00' }] })
  const result = await api(
    page,
    'POST',
    '/orders',
    {
      quoteId: cart.quote.id,
      walletSlot: 'primary',
    provider: 'metamask',
      network: 'ethereum',
      collector: { displayName: 'Ana', username: 'ana', email: 'ana@kurio.test' },
      note: '',
    },
    { ...ana, 'Idempotency-Key': 'key-stale' },
  )
  expect(result.status).toBe(409)
  expect(result.data.code).toBe('QUOTE_CHANGED')
  expect(result.data.quote.subtotal).toBe('2')
})
