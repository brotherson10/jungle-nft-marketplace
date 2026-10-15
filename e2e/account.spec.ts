import { expect, test } from '@playwright/test'
import { addToCart, ANA, api, BRUNO, fillLogin, loginAt, open } from './helpers'

test('login retorna ao checkout; expiração preserva o contexto; troca de usuário isola os dados', async ({ page }) => {
  await open(page, '/')
  await addToCart(page, 'nft-001')
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await fillLogin(page, ANA)
  // Carrinho do visitante preservado ao autenticar.
  await expect(page).toHaveURL(/\/pagamento$/)
  await expect(page.getByRole('complementary', { name: 'Seus NFTs' })).toContainText('Emerald Ape #042')
  await page.getByLabel('Observação do colecionador (opcional)').fill('Presente de aniversário')

  // Sessão expira durante o checkout: volta ao login e retoma com o rascunho.
  await api(page, 'POST', '/__mock/sessions/expire')
  await page.reload()
  await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
  await expect(page.getByRole('alert').filter({ hasText: 'Sua sessão expirou' })).toBeVisible()
  await fillLogin(page, ANA)
  await expect(page).toHaveURL(/\/pagamento$/)
  await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue('Presente de aniversário')

  // Favorito e pedido da Ana.
  await page.goto('/nft/nft-002')
  const favorite = page.getByRole('button', { name: 'Favoritar Sage Nomad #009' }).filter({ visible: true })
  await favorite.click()
  await expect(favorite).toHaveAttribute('aria-pressed', 'true')

  // Logout e login como outro usuário.
  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/$/)
  await loginAt(page, BRUNO, '/carrinho')
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  await page.goto('/?favorites=true')
  await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
  await page.goto('/nft/nft-002')
  await expect(favorite).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('realtime-status')).toHaveText('Tempo real: connected')
})

test('favorito otimista faz rollback na falha e persiste após nova tentativa', async ({ page }) => {
  await open(page, '/', 'favorite-error')
  await loginAt(page, ANA, '/nft/nft-003')
  const add = page.getByRole('button', { name: 'Favoritar Neon Vessel #552' }).filter({ visible: true })
  await add.click()
  await expect(page.getByText('Não foi possível favoritar. Tente novamente.')).toBeVisible()
  await expect(add).toHaveAttribute('aria-pressed', 'false')

  await add.click()
  await expect(page.getByText('Adicionado aos favoritos.')).toBeVisible()
  await page.reload()
  await expect(add).toHaveAttribute('aria-pressed', 'true')
})

test('perfil e carteiras validam campos e persistem após refresh', async ({ page }) => {
  await open(page, '/')
  await loginAt(page, BRUNO, '/carteiras')

  const primary = page.getByRole('form', { name: 'Carteira principal' })
  await primary.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(primary.getByText('Endereço 0x com 40 caracteres hexadecimais.')).toBeVisible()
  await expect(primary.getByLabel('Endereço da carteira')).toHaveAttribute('aria-invalid', 'true')

  await primary.getByLabel('Nome de exibição').fill('Bruno Curador')
  await primary.getByLabel('Apelido da carteira').fill('Principal')
  await primary.getByRole('combobox', { name: 'Rede' }).click()
  await page.getByRole('option', { name: 'Polygon' }).click()
  await primary.getByLabel('Nome do perfil').fill('bruno.kurio')
  await primary.getByLabel('Endereço da carteira').fill('0x1234567890abcdef1234567890abcdef12345678')
  await primary.getByRole('combobox', { name: 'Tipo de carteira' }).click()
  await page.getByRole('option', { name: 'Coinbase Wallet' }).click()
  await primary.getByLabel('Código de indicação').fill('KURIO-BRUNO')
  await primary.getByLabel('E-mail').fill('bruno@kurio.test')
  await primary.getByLabel('Nome ENS').fill('bruno')
  await primary.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(page.getByText('Carteira principal salva.')).toBeVisible()

  await page.reload()
  await expect(primary.getByLabel('Endereço da carteira')).toHaveValue('0x1234567890abcdef1234567890abcdef12345678')
  await expect(primary.getByRole('combobox', { name: 'Rede' })).toHaveText('Polygon')

  await page.goto('/perfil')
  const profile = page.getByRole('form', { name: 'Dados do perfil' })
  await profile.getByLabel('E-mail').fill('ana@kurio.test')
  await profile.getByRole('button', { name: 'Salvar' }).click()
  await expect(profile.getByText('E-mail já cadastrado.')).toBeVisible()
  await profile.getByLabel('E-mail').fill('bruno@kurio.test')
  await profile.getByLabel('Nome de exibição').fill('Bruno Atualizado')
  await profile.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Perfil atualizado.')).toBeVisible()

  const password = page.getByRole('form', { name: 'Alterar senha' })
  await password.getByLabel('Senha atual').fill('errada123')
  await password.getByLabel('Nova senha', { exact: true }).fill('NovaSenha1')
  await password.getByLabel('Confirmar nova senha').fill('NovaSenha1')
  await password.getByRole('button', { name: 'Alterar senha' }).click()
  await expect(password.getByText('Senha atual incorreta.')).toBeVisible()

  await page.reload()
  await expect(profile.getByLabel('Nome de exibição')).toHaveValue('Bruno Atualizado')
})
