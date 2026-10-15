import { expect, test } from '@playwright/test'
import { addToCart, ANA, api, connectAndReview, countOrderFetches, expectRealtime, fillLogin, open } from './helpers'

test('compra completa do catálogo ao recibo, com confirmação via order.updated', async ({ page }) => {
  await open(page, '/')
  // Visitante escolhe pelo catálogo e compra; o login acontece no meio do fluxo.
  await page.getByTestId('catalog-grid').getByRole('link', { name: 'Emerald Ape #042' }).click()
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: 'COMPRAR', exact: true }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
  await expect(page.getByTestId('summary-total')).toHaveText('2.396 ETH')

  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
  await fillLogin(page, ANA)
  await expect(page).toHaveURL(/\/pagamento$/)
  await expectRealtime(page)

  const orderFetches = countOrderFetches(page)
  await connectAndReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page).toHaveURL(/\/pedidos\/ord-\d+$/)
  await expect(page.getByTestId('order-status')).toHaveText('Confirmado')
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
  await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')
  await expect(page.getByTestId('receipt-lines')).toContainText('Emerald Ape #042')
  await expect(page.getByTestId('transaction-id')).toHaveText(/^0x[0-9a-f]{4}…[0-9a-f]{4}$/)
  // Nenhum GET do pedido: pendente → confirmado chegou pelo socket.io-client.
  expect(orderFetches).toHaveLength(0)

  // Apenas as quantidades compradas saem do carrinho.
  await page.goto('/carrinho')
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
})

test('pagamento recusado preserva os itens no carrinho', async ({ page }) => {
  await open(page, '/', 'payment-declined')
  await addToCart(page, 'nft-002')
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await fillLogin(page, ANA)
  await connectAndReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()

  await expect(page.getByTestId('order-status')).toHaveText('Recusado')
  await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByTestId('cart-lines')).toContainText('Sage Nomad #009')
})

test('timeout após criação recupera o mesmo pedido, inclusive após refresh', async ({ page }) => {
  test.setTimeout(60_000)
  await open(page, '/', 'order-timeout')
  await addToCart(page, 'nft-003')
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await fillLogin(page, ANA)
  await connectAndReview(page)

  const posts: string[] = []
  page.on('request', (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/orders' && posts.push(r.headers()['idempotency-key'] ?? ''))
  // Clique repetido: o botão bloqueia e a chave de idempotência evita duplicidade.
  await page.getByRole('button', { name: 'Confirmar compra' }).dblclick()
  await expect(page.getByRole('button', { name: 'Enviando pedido…' })).toBeDisabled()

  // A primeira resposta excede o timeout do cliente; o retry com a mesma chave recupera o pedido.
  await expect(page).toHaveURL(/\/pedidos\/ord-\d+$/, { timeout: 20_000 })
  expect(posts.length).toBeGreaterThanOrEqual(2)
  expect(new Set(posts).size).toBe(1)
  const orderUrl = page.url()

  await page.reload()
  await expect(page).toHaveURL(orderUrl)
  await expect(page.getByTestId('order-status')).toHaveText('Confirmado')
  const orders = await api(page, 'GET', '/orders')
  expect(orders.data).toHaveLength(1)
})

test('desconexão com pedido pendente: reconexão reconcilia via REST sem nova compra', async ({ page }) => {
  await open(page, '/', 'default')
  await addToCart(page, 'nft-004')
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await fillLogin(page, ANA)
  await connectAndReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByTestId('order-status')).toHaveText('Pendente')

  const orderFetches = countOrderFetches(page)
  // Derruba o socket antes da liquidação; o evento order.updated é perdido.
  const dropped = await api(page, 'POST', '/__mock/socket/drop')
  expect(dropped.data.dropped).toBeGreaterThan(0)
  await expectRealtime(page)
  await expect(page.getByTestId('order-status')).toHaveText('Confirmado', { timeout: 10_000 })
  expect(orderFetches.length).toBeGreaterThan(0)
  expect((await api(page, 'GET', '/orders')).data).toHaveLength(1)
})
