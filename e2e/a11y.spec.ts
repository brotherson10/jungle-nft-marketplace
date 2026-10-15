import { expect, test } from '@playwright/test'
import { open } from './helpers'

test('teclado: link de pular conteúdo, edição por setas e foco do diálogo de imagem', async ({ page }) => {
  await open(page, '/nft/nft-001')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('#conteudo')).toBeFocused()

  // Grupo de edições: setas trocam a seleção (radio nativo) e o preço acompanha.
  await page.getByRole('radio', { name: '1/50' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'ABERTA' })).toBeChecked()
  await expect(page.getByTestId('nft-price')).toHaveText('0.595 ETH')

  // Diálogo: foco entra, fica preso, Escape fecha e devolve o foco ao gatilho.
  const zoom = page.getByRole('button', { name: 'Ampliar imagem' })
  await zoom.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Emerald Ape #042' })
  await expect(dialog).toBeVisible()
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(zoom).toBeFocused()
})

test('diálogo de login: foco preso, validação associada aos campos e Escape fecha', async ({ page }) => {
  await open(page, '/entrar')
  const dialog = page.getByRole('dialog', { name: 'Entrar' })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }

  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  const email = dialog.getByLabel('E-mail')
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(email).toHaveAccessibleDescription('Informe um e-mail válido.')
  await expect(dialog.getByLabel('Senha', { exact: true })).toHaveAccessibleDescription('Informe a senha.')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/$/)
})

test('skeletons no carregamento lento respeitam movimento reduzido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?__reset=1&__scenario=slow')
  const skeleton = page.getByTestId('catalog-grid').locator('[data-slot=skeleton]').first()
  await expect(skeleton).toBeVisible({ timeout: 30_000 })
  expect(await skeleton.evaluate((el) => getComputedStyle(el).animationIterationCount)).toBe('1')
  await expect(page.getByTestId('catalog-grid').getByRole('article')).toHaveCount(9, { timeout: 15_000 })
  await expect(skeleton).toHaveCount(0)
})

test('falha do catálogo mostra erro acessível e recupera na nova tentativa', async ({ page }) => {
  await page.goto('/?__reset=1&__scenario=catalog-error')
  const error = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo.' })
  await expect(error).toBeVisible({ timeout: 30_000 })
  await expect(error).toContainText('Serviço temporariamente indisponível')
  await error.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByTestId('catalog-grid').getByRole('article')).toHaveCount(9)
})
