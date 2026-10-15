import { defineConfig, devices } from '@playwright/test'

const PORT = 5173
// E2E_BASE_URL=https://... executa a suíte contra um ambiente publicado (sem dev server local).
const EXTERNAL = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e',
  // Fluxos completos (catálogo → recibo) com vários passos e latência simulada.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: EXTERNAL ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: EXTERNAL
    ? undefined
    : {
        // Mocks MSW ativos via .env (VITE_ENABLE_MOCKS=true).
        command: `npm run dev -- --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
      },
})
