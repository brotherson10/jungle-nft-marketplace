# Lighthouse — medianas (3 medições por página e perfil)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT | FCP |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio | mobile | 80 | 100 | 100 | 100 | 4.00 s | 0.003 | 233 ms | 2.34 s |
| inicio | desktop | 98 | 100 | 100 | 100 | 1.10 s | 0.008 | 15 ms | 0.73 s |
| detalhe | mobile | 74 | 100 | 100 | 100 | 4.07 s | 0.002 | 356 ms | 2.63 s |
| detalhe | desktop | 97 | 100 | 100 | 100 | 1.15 s | 0.006 | 27 ms | 0.76 s |

## Ambiente

- **date**: 2026-10-15T15:35:54.909Z
- **lighthouse**: 13.5.0
- **chrome**: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36
- **node**: v24.16.0
- **os**: Windows_NT 10.0.26300 (x64)
- **cpu**: AMD Ryzen 7 170 with Radeon Graphics
- **memoryGb**: 14
- **server**: vite preview (build de produção, dist/)
- **mocks**: MSW ativo, cenário "default" (latência 250 ms), estado inicial limpo a cada medição
- **throttling**: mobile: padrão Lighthouse (simulado, 4G lento, CPU 4x); desktop: desktop-config (simulado)

Relatórios completos em `lighthouse/reports/` (`<pagina>-<perfil>-<n>.report.html|json`).
