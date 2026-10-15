import { expect, test } from '@playwright/test'
import { addToCart, ANA, api, connectAndReview, fillLogin, open } from './helpers'

test('detalhe carregado via REST/MSW recebe nova cotação por Socket.IO e ignora eventos antigos', async ({ page }) => {
  const detailRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/nfts/nft-001') detailRequests.push(request.method())
  })

  await open(page, '/nft/nft-001')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042', level: 1 })).toBeVisible()
  await expect(page.getByTestId('nft-price')).toHaveText('1.19 ETH')
  const restCalls = detailRequests.length
  expect(restCalls).toBeGreaterThan(0)

  // Mudança no estado do MSW (outro comprador/criador); o cliente só a recebe pelo socket.
  expect((await api(page, 'POST', '/__mock/nfts/nft-001', { editions: [{ id: 'nft-001-1-50', price: '1.25', available: 3 }] })).status).toBe(200)
  await expect(page.getByTestId('nft-price')).toHaveText('1.25 ETH')
  await expect(page.getByTestId('edition-availability')).toContainText('3 disponíveis')

  await api(page, 'POST', '/__mock/nfts/nft-001', { editions: [{ id: 'nft-001-1-50', price: '1.30' }] })
  await expect(page.getByTestId('nft-price')).toHaveText('1.30 ETH')
  // Reenvio dos dois últimos eventos (duplicata + versão antiga): o estado não regride.
  expect((await api(page, 'POST', '/__mock/events/replay', { count: 2 })).data.replayed).toBe(2)
  await page.waitForTimeout(300)
  await expect(page.getByTestId('nft-price')).toHaveText('1.30 ETH')
  // Nenhum refetch REST do detalhe: as atualizações vieram de nft.updated.
  expect(detailRequests.length).toBe(restCalls)

  await page.reload()
  await expect(page.getByTestId('nft-price')).toHaveText('1.30 ETH')
})

test('preço alterado via Socket.IO durante o checkout bloqueia a cotação antiga', async ({ page }) => {
  await open(page, '/')
  await addToCart(page, 'nft-005')
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await fillLogin(page, ANA)
  await connectAndReview(page)
  await expect(page.getByTestId('summary-total')).toHaveText('1.406 ETH')

  await api(page, 'POST', '/__mock/nfts/nft-005', { editions: [{ id: 'nft-005-1-50', price: '1.50' }] })

  await expect(page.getByText('O preço ou a disponibilidade de Violet Nomad #314 mudou')).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Os valores mudaram desde a sua revisão' })).toBeVisible()
  await expect(page.getByTestId('summary-total')).toHaveText('1.516 ETH')
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()

  await page.getByRole('button', { name: 'Revisar novamente' }).click()
  await expect(page.getByTestId('order-review')).toContainText('Total revisado: 1.516 ETH')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByTestId('order-status')).toHaveText('Confirmado')
  await expect(page.getByTestId('receipt-total')).toHaveText('1.516 ETH')
})
