/**
 * Auditoria Lighthouse do build otimizado (dist/) com o cenário padrão dos mocks.
 * Início e detalhe × mobile/desktop × 3 medições; relatórios HTML/JSON + resumo com medianas.
 *
 * Uso: npm run audit:lighthouse   (faz o build antes)
 * Chrome: CHROME_PATH ou o Chromium instalado pelo Playwright.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from '@playwright/test'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

const PORT = 4173
const BASE = `http://localhost:${PORT}`
const RUNS = 3
const PAGES = [
  { name: 'inicio', path: '/' },
  { name: 'detalhe', path: '/nft/nft-001' },
]
const PROFILES = [
  { name: 'mobile', config: undefined }, // padrão do Lighthouse: Moto G Power, 4G lento simulado, CPU 4x
  { name: 'desktop', config: desktopConfig },
]
const OUT = path.resolve('lighthouse')
const REPORTS = path.join(OUT, 'reports')
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const METRICS = { LCP: 'largest-contentful-paint', CLS: 'cumulative-layout-shift', TBT: 'total-blocking-time', FCP: 'first-contentful-paint' }

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Servidor não respondeu em ${url}`)
}

fs.mkdirSync(REPORTS, { recursive: true })
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const chromePath = process.env.CHROME_PATH ?? chromium.executablePath()
const results = []
let debugPort = 9333

try {
  await waitForServer(BASE)
  for (const page of PAGES) {
    for (const profile of PROFILES) {
      for (let run = 1; run <= RUNS; run++) {
        // Chrome novo por medição: perfil limpo (sem cache nem service worker anterior).
        const chrome = await chromeLauncher.launch({ chromePath, port: debugPort++, chromeFlags: ['--headless=new', '--no-first-run'] })
        try {
          const result = await lighthouse(`${BASE}${page.path}`, { port: chrome.port, output: ['html', 'json'], logLevel: 'error' }, profile.config)
          const base = path.join(REPORTS, `${page.name}-${profile.name}-${run}`)
          fs.writeFileSync(`${base}.report.html`, result.report[0])
          fs.writeFileSync(`${base}.report.json`, result.report[1])
          const lhr = result.lhr
          const entry = {
            page: page.name,
            profile: profile.name,
            run,
            scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round(lhr.categories[c].score * 100)])),
            metrics: Object.fromEntries(Object.entries(METRICS).map(([k, id]) => [k, lhr.audits[id].numericValue])),
            lighthouseVersion: lhr.lighthouseVersion,
            userAgent: lhr.environment.hostUserAgent,
          }
          results.push(entry)
          console.log(page.name, profile.name, run, entry.scores, Object.fromEntries(Object.entries(entry.metrics).map(([k, v]) => [k, Math.round(v * 1000) / 1000])))
        } finally {
          await chrome.kill()
        }
      }
    }
  }
} finally {
  preview.kill()
}

const groups = []
for (const page of PAGES)
  for (const profile of PROFILES) {
    const runs = results.filter((r) => r.page === page.name && r.profile === profile.name)
    groups.push({
      page: page.name,
      profile: profile.name,
      scores: Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
      metrics: Object.fromEntries(Object.keys(METRICS).map((k) => [k, median(runs.map((r) => r.metrics[k]))])),
    })
  }

const env = {
  date: new Date().toISOString(),
  lighthouse: results[0]?.lighthouseVersion,
  chrome: results[0]?.userAgent,
  node: process.version,
  os: `${os.type()} ${os.release()} (${os.arch()})`,
  cpu: os.cpus()[0]?.model,
  memoryGb: Math.round(os.totalmem() / 1024 ** 3),
  server: 'vite preview (build de produção, dist/)',
  mocks: 'MSW ativo, cenário "default" (latência 250 ms), estado inicial limpo a cada medição',
  throttling: 'mobile: padrão Lighthouse (simulado, 4G lento, CPU 4x); desktop: desktop-config (simulado)',
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ env, medians: groups, runs: results }, null, 2))

const fmt = (m) => `${(m.LCP / 1000).toFixed(2)} s | ${m.CLS.toFixed(3)} | ${Math.round(m.TBT)} ms | ${(m.FCP / 1000).toFixed(2)} s`
const lines = [
  '# Lighthouse — medianas (3 medições por página e perfil)',
  '',
  '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT | FCP |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...groups.map((g) => `| ${g.page} | ${g.profile} | ${g.scores.performance} | ${g.scores.accessibility} | ${g.scores['best-practices']} | ${g.scores.seo} | ${fmt(g.metrics)} |`),
  '',
  '## Ambiente',
  '',
  ...Object.entries(env).map(([k, v]) => `- **${k}**: ${v}`),
  '',
  'Relatórios completos em `lighthouse/reports/` (`<pagina>-<perfil>-<n>.report.html|json`).',
  '',
]
fs.writeFileSync(path.join(OUT, 'summary.md'), lines.join('\n'))
console.log(lines.join('\n'))
