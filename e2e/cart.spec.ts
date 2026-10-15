import { expect, test } from '@playwright/test'
import { addToCart, ANA, api, fillLogin, open } from './helpers'

test('carrinho: quantidades, remoção, cupons e persistência após refresh e login', async ({ page }) => {
  await open(page, '/')
  await addToCart(page, 'nft-001', 2)
  await addToCart(page, 'nft-007')
  await expect(page.getByTestId('cart-line')).toHaveCount(2)
  await expect(page.getByTestId('summary-subtotal')).toHaveText('3.37 ETH')

  await page.getByRole('group', { name: 'Quantidade de Emerald Ape #042' }).getByRole('button', { name: 'Aumentar quantidade' }).click()
  await expect(page.getByTestId('summary-subtotal')).toHaveText('4.56 ETH')
  await page.getByRole('button', { name: 'Remover Golden Beat #207 do carrinho' }).click()
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByTestId('summary-total')).toHaveText('3.586 ETH')

  const coupon = page.getByRole('textbox', { name: 'Código promocional' })
  await coupon.fill('NAOEXISTE')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Cupom inválido.' })).toBeVisible()
  await expect(coupon).toHaveAttribute('aria-invalid', 'true')
  await coupon.fill('VERAO2025')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Cupom expirado.' })).toBeVisible()
  await coupon.fill('kurio10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  // 10% de 3.57 = 0.357; total = 3.57 - 0.357 + 0.016.
  await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0.357 ETH')
  await expect(page.getByTestId('summary-total')).toHaveText('3.229 ETH')

  await page.reload()
  await expect(page.getByText('Cupom KURIO10 aplicado')).toBeVisible()
  await expect(page.getByTestId('summary-total')).toHaveText('3.229 ETH')

  // Login preserva os itens e o cupom do visitante.
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await fillLogin(page, ANA)
  await page.goto('/carrinho')
  await expect(page.getByTestId('cart-line')).toHaveCount(1)
  await expect(page.getByTestId('summary-total')).toHaveText('3.229 ETH')

  await page.getByRole('button', { name: 'Remover', exact: true }).click()
  await expect(page.getByTestId('summary-total')).toHaveText('3.586 ETH')
})

test('disponibilidade reduzida e edição esgotada via Socket.IO bloqueiam a finalização', async ({ page }) => {
  await open(page, '/')
  await addToCart(page, 'nft-008', 3)
  const finalize = page.getByRole('button', { name: 'Conectar e finalizar' })
  await expect(finalize).toBeEnabled()

  await api(page, 'POST', '/__mock/nfts/nft-008', { editions: [{ id: 'nft-008-1-50', available: 1 }] })
  await expect(page.getByText('O preço ou a disponibilidade de Golden Frequency #071 mudou')).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Apenas 1 disponíveis. Ajuste a quantidade.' })).toBeVisible()
  await expect(finalize).toBeDisabled()

  await api(page, 'POST', '/__mock/nfts/nft-008', { editions: [{ id: 'nft-008-1-50', available: 0 }] })
  await expect(page.getByRole('alert').filter({ hasText: 'Edição esgotada. Remova o item para continuar.' })).toBeVisible()
  await page.getByRole('button', { name: 'Remover Golden Frequency #071 do carrinho' }).click()
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
})
