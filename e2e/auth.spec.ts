import { expect, test } from '@playwright/test'
import { BRUNO, fillLogin, loginAt, open } from './helpers'

// PNG 1x1 válido para o upload de avatar.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

test('cadastro: validação, conflito de conta e criação com sessão', async ({ page }) => {
  await open(page, '/cadastro')
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Criar conta' }).click()
  await expect(dialog.getByLabel('Nome de usuário')).toHaveAccessibleDescription('Use 3 a 20 letras, números, "_" ou ".".')
  await expect(dialog.getByLabel('E-mail')).toHaveAccessibleDescription('Informe um e-mail válido.')

  await dialog.getByLabel('Nome de usuário').fill('ana')
  await dialog.getByLabel('E-mail').fill('ANA@kurio.test')
  await dialog.getByLabel('Senha', { exact: true }).fill('Segura123')
  await dialog.getByLabel('Confirmar senha').fill('Outra123')
  await dialog.getByRole('button', { name: 'Criar conta' }).click()
  await expect(dialog.getByLabel('Confirmar senha')).toHaveAccessibleDescription('As senhas não conferem.')

  // Conflito retornado pela API, associado aos campos.
  await dialog.getByLabel('Confirmar senha').fill('Segura123')
  await dialog.getByRole('button', { name: 'Criar conta' }).click()
  await expect(dialog.getByLabel('E-mail')).toHaveAccessibleDescription('Este e-mail já está cadastrado.')
  await expect(dialog.getByLabel('Nome de usuário')).toHaveAccessibleDescription('Este nome de usuário já está em uso.')

  await dialog.getByLabel('Nome de usuário').fill('carla')
  await dialog.getByLabel('E-mail').fill('carla@kurio.test')
  await dialog.getByRole('button', { name: 'Criar conta' }).click()
  await expect(dialog).toBeHidden()
  await page.goto('/perfil')
  await expect(page.getByRole('form', { name: 'Dados do perfil' }).getByLabel('E-mail')).toHaveValue('carla@kurio.test')
})

test('avatar e senha: validação, persistência e novo login', async ({ page }) => {
  await open(page, '/')
  await loginAt(page, BRUNO, '/perfil')

  const fileInput = page.locator('input[type=file]')
  await fileInput.setInputFiles({ name: 'avatar.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
  await expect(page.getByRole('alert').filter({ hasText: 'Envie uma imagem PNG, JPEG ou WebP.' })).toBeVisible()
  await fileInput.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()
  await page.getByRole('button', { name: 'Remover avatar' }).click()
  await expect(page.getByRole('img', { name: 'Sem avatar' })).toBeVisible()

  const form = page.getByRole('form', { name: 'Alterar senha' })
  await form.getByLabel('Senha atual').fill(BRUNO.password)
  await form.getByLabel('Nova senha', { exact: true }).fill('curta')
  await form.getByLabel('Confirmar nova senha').fill('diferente')
  await form.getByRole('button', { name: 'Alterar senha' }).click()
  await expect(form.getByLabel('Nova senha', { exact: true })).toHaveAccessibleDescription('A senha precisa de 8+ caracteres, com letras e números.')
  await expect(form.getByLabel('Confirmar nova senha')).toHaveAccessibleDescription('As senhas não conferem.')

  await form.getByLabel('Nova senha', { exact: true }).fill('NovaSenha9')
  await form.getByLabel('Confirmar nova senha').fill('NovaSenha9')
  await form.getByRole('button', { name: 'Alterar senha' }).click()
  await expect(page.getByText('Senha alterada.')).toBeVisible()

  // A senha antiga deixa de valer; a nova autentica.
  await page.getByRole('button', { name: 'Sair' }).click()
  await page.goto('/entrar')
  await page.getByRole('dialog').getByLabel('E-mail').fill(BRUNO.email)
  await page.getByRole('dialog').getByLabel('Senha', { exact: true }).fill(BRUNO.password)
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
  await fillLogin(page, { email: BRUNO.email, password: 'NovaSenha9' })
})
