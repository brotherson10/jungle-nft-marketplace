import { expect, test, type Page } from '@playwright/test'
import { open } from './helpers'

const cards = (page: Page) => page.getByTestId('catalog-grid').getByRole('article')
const names = (page: Page) => page.getByTestId('catalog-grid').getByRole('link').allInnerTexts()

async function search(page: Page, isMobile: boolean, term: string) {
  if (isMobile) {
    await page.getByRole('searchbox', { name: 'Explorar coleções' }).fill(term)
    await page.getByRole('searchbox', { name: 'Explorar coleções' }).press('Enter')
  } else {
    await page.getByRole('button', { name: 'Abrir busca' }).click()
    await page.getByRole('textbox', { name: 'Buscar NFTs' }).fill(term)
    await page.getByRole('textbox', { name: 'Buscar NFTs' }).press('Enter')
  }
}

/** Alterna filtros pela barra lateral (desktop) ou pelo drawer de filtros (mobile). */
async function toggleFilters(page: Page, isMobile: boolean, labels: RegExp[]) {
  const scope = isMobile ? page.getByRole('dialog', { name: 'Filtros' }) : page.getByRole('complementary', { name: 'Filtros' })
  if (isMobile) await page.getByRole('button', { name: /^Filtros/ }).click()
  for (const label of labels) await scope.getByRole('checkbox', { name: label }).click()
  if (isMobile) {
    await page.keyboard.press('Escape')
    await expect(scope).toBeHidden()
  }
}

test('busca, filtros combinados, ordenação e paginação na URL com histórico e refresh', async ({ page, isMobile }) => {
  await open(page, '/')
  await expect(cards(page)).toHaveCount(9)

  await page.getByRole('button', { name: 'Página 2' }).click()
  await expect(page).toHaveURL(/[?&]page=2/)
  await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

  // Nova busca reinicia a paginação.
  await search(page, isMobile, 'nomad')
  await expect(page).toHaveURL(/q=nomad/)
  await expect(page).not.toHaveURL(/page=/)
  await expect(cards(page)).toHaveCount(8)
  for (const name of await names(page)) expect(name).toContain('Nomad')

  // Combinação sem resultado: estado vazio.
  await toggleFilters(page, isMobile, [/^Ethereum/])
  await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()

  await toggleFilters(page, isMobile, [/^Ethereum/, /^Polygon/, /^Fotografia/])
  // Arrays são serializados como JSON na URL pelo TanStack Router.
  await expect.poll(() => decodeURIComponent(page.url())).toContain('networks=["polygon"]')
  await expect.poll(() => decodeURIComponent(page.url())).toContain('categories=["fotografia"]')
  await expect.poll(() => names(page)).toEqual(['Sage Nomad #009', 'Copper Nomad #233', 'Onyx Nomad #359'])

  await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
  await page.getByRole('option', { name: 'Maior preço' }).click()
  await expect(page).toHaveURL(/sort=price-desc/)
  await expect.poll(() => names(page)).toEqual(['Copper Nomad #233', 'Sage Nomad #009', 'Onyx Nomad #359'])
  await expect(page.getByTestId('nft-card-price')).toHaveText(['Preço: 8.77 ETH', 'Preço: 1.69 ETH', 'Preço: 1.27 ETH'])

  // Histórico: voltar desfaz ordenação e filtros; avançar restaura.
  await page.goBack()
  await expect(page).not.toHaveURL(/sort=/)
  await expect.poll(() => names(page)).toEqual(['Sage Nomad #009', 'Copper Nomad #233', 'Onyx Nomad #359'])
  await page.goBack()
  await expect(page).not.toHaveURL(/categories=/)
  await expect(cards(page)).toHaveCount(8)
  await page.goForward()
  await page.goForward()
  await expect(page).toHaveURL(/sort=price-desc/)
  await expect.poll(() => names(page)).toEqual(['Copper Nomad #233', 'Sage Nomad #009', 'Onyx Nomad #359'])

  // Refresh mantém o estado da URL.
  await page.reload()
  await expect.poll(() => names(page)).toEqual(['Copper Nomad #233', 'Sage Nomad #009', 'Onyx Nomad #359'])
  if (!isMobile) await expect(page.getByRole('complementary', { name: 'Filtros' }).getByRole('checkbox', { name: /^Fotografia/ })).toBeChecked()
})

test('acesso direto a NFT inexistente e edição indisponível', async ({ page }) => {
  await open(page, '/nft/nao-existe')
  await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()
  await expect(cards(page)).toHaveCount(9)

  // nft-001 tem a edição 1/1 esgotada no seed.
  await page.goto('/nft/nft-001')
  await expect(page.getByRole('radio', { name: '1/1 (esgotada)' })).toBeDisabled()
  // Chips de edição: o rádio é visualmente oculto e o usuário clica no rótulo.
  await page.locator('label').filter({ hasText: /^1\/10$/ }).click()
  await expect(page.getByRole('radio', { name: '1/10' })).toBeChecked()
  await expect(page.getByTestId('nft-price')).toHaveText('2.38 ETH')
  await expect(page.getByTestId('edition-availability')).toHaveText('10 disponíveis · até 3 por pedido')
  const plus = page.getByRole('button', { name: 'Aumentar quantidade' })
  await plus.click()
  await plus.click()
  await expect(plus).toBeDisabled()
})

test('rota inexistente mostra página não encontrada', async ({ page }) => {
  await open(page, '/rota/que/nao/existe')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})
