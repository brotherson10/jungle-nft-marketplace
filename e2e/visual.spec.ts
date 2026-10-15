import { expect, test, type Page } from '@playwright/test'
import { ANA, api, open } from './helpers'

/**
 * Regressão visual com dados estáveis (seed + cenário "fast"). As baselines protegem contra
 * regressões; a fidelidade ao Figma foi verificada comparando-as com /design-reference.
 */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  // Rola a página para disparar as imagens lazy antes da captura de página inteira.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    window.scrollTo(0, 0)
  })
  // Apenas imagens renderizadas (seções display:none no mobile não carregam imagens lazy).
  await page.waitForFunction(() =>
    [...document.images].filter((img) => img.getClientRects().length > 0).every((img) => img.complete && img.naturalWidth > 0),
  )
  await page.waitForLoadState('networkidle')
}

/** Sessão e carrinho iguais aos frames do Figma (setup via API simulada, sem toasts). */
async function seedCart(page: Page) {
  for (const [nftId, quantity] of [['nft-001', 2], ['nft-005', 6], ['nft-006', 9]] as const)
    await api(page, 'POST', '/cart/items', { nftId, editionId: `${nftId}-1-50`, quantity })
  const { data } = await api(page, 'POST', '/auth/login', ANA)
  await page.evaluate((session) => localStorage.setItem('kurio.session', JSON.stringify(session)), data)
}

const shot = { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.01 } as const

test('início', async ({ page }) => {
  await open(page, '/')
  await settle(page)
  await expect(page).toHaveScreenshot('inicio.png', shot)
})

test('detalhe', async ({ page }) => {
  await open(page, '/nft/nft-001')
  await settle(page)
  await expect(page).toHaveScreenshot('detalhe.png', shot)
})

test('carrinho', async ({ page }) => {
  await open(page, '/')
  await seedCart(page)
  await page.goto('/carrinho')
  await expect(page.getByTestId('summary-total')).toHaveText('26.846 ETH')
  await settle(page)
  await expect(page).toHaveScreenshot('carrinho.png', shot)
})

test('pagamento', async ({ page }) => {
  await open(page, '/')
  await seedCart(page)
  await page.goto('/pagamento')
  await expect(page.getByTestId('summary-total')).toHaveText('26.846 ETH')
  await settle(page)
  await expect(page).toHaveScreenshot('pagamento.png', shot)
})
