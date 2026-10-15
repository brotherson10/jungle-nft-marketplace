# Kurio — Marketplace de NFTs

Solução do [desafio frontend](https://github.com/junglegaming/frontend-challenge): React + TypeScript com TanStack Router/Query, Axios, Socket.IO, Tailwind CSS, shadcn/ui, MSW, Playwright e Lighthouse. Toda a regra de negócio (catálogo, sessão, carrinho, cotação, pedidos, carteiras) é simulada **exclusivamente na camada MSW**, inclusive no build público; o tempo real passa por `socket.io-client` sobre um WebSocket interceptado pelo MSW.

- Aplicação: https://jungle-nft-marketplace-phi.vercel.app
- Repositório: https://github.com/brotherson10/jungle-nft-marketplace
- Decisões, contratos e limitações: [ARCHITECTURE.md](ARCHITECTURE.md)
- Auditoria de performance: [lighthouse/summary.md](lighthouse/summary.md)

## Requisitos

- Node.js **22.12+** (testado com 24.16) e npm 10+
- Para os testes: Chromium do Playwright (`npx playwright install chromium`)

## Setup a partir de um checkout limpo

```sh
npm ci
npm run dev            # http://localhost:5173 com mocks ativos
```

## Variáveis de ambiente

Definidas em `.env` (versionado, sem segredos). Para sobrescrever localmente, use `.env.local`.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa MSW (REST + Socket.IO). Mantido `true` no build de demonstração. |
| `VITE_API_URL` | `/api` | Base do Axios. |
| `VITE_SOCKET_URL` | `https://realtime.kurio.mock` | Host do Socket.IO (interceptado pelo MSW; não existe servidor real). |

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks. |
| `npm run build` | Gera rotas, verifica tipos e cria o build otimizado em `dist/`. |
| `npm run preview` | Serve `dist/` (porta 4173). |
| `npm run typecheck` | `tsr generate` + `tsc -b` (TypeScript strict). |
| `npm run lint` | ESLint. |
| `npm run test:e2e` | Playwright (Chromium desktop 1440×900 e mobile Pixel 7), sobe o dev server sozinho. |
| `E2E_BASE_URL=https://jungle-nft-marketplace-phi.vercel.app npm run test:e2e` | Mesma suíte contra o ambiente publicado (sem dev server local). |
| `npm run test:e2e:report` | Abre o relatório HTML (`playwright-report/`). Traces e screenshots ficam em `test-results/` em caso de falha. |
| `npx playwright test e2e/visual.spec.ts --update-snapshots` | Regera as baselines visuais (revise as imagens antes de versionar). |
| `npm run audit:lighthouse` | Build + Lighthouse (início e detalhe × mobile/desktop × 3), relatórios em `lighthouse/`. |

## Credenciais fictícias

| Usuário | E-mail | Senha | Observação |
| --- | --- | --- | --- |
| Ana Colecionadora | `ana@kurio.test` | `Kurio@123` | Possui carteira principal (MetaMask, Ethereum). |
| Bruno Curador | `bruno@kurio.test` | `Kurio@456` | Sem carteiras: use para cadastrar/validar carteiras. |

Cupons: `KURIO10` (10%), `GENESIS` (0.05 ETH), `VERAO2025` (expirado); qualquer outro código é inválido.

## Cenários e reset

O estado simulado é persistido no `localStorage` (sobrevive a refresh) e o cenário ativo fica junto dele.

- `?__scenario=<nome>` troca o cenário mantendo os dados.
- `?__reset=1` restaura o seed (pode combinar: `/?__reset=1&__scenario=slow`). O reset também encerra a sessão do cliente.

| Cenário | Efeito |
| --- | --- |
| `default` | Latência 250 ms, pagamento confirmado em 2,5 s. |
| `fast` | Sem latência, pagamento em 300 ms (usado nos testes). |
| `slow` | Latência de 2,5 s (skeletons). |
| `variable-latency` | 50–1800 ms, determinística por URL (respostas fora de ordem). |
| `empty-catalog` | Catálogo vazio. |
| `catalog-error` | `GET /api/nfts` falha 3× com 500 (esgota os retries automáticos). |
| `offline` | Toda requisição REST falha por rede. |
| `favorite-error` | Primeira inclusão de favorito responde 503 (rollback otimista). |
| `payment-declined` | Pagamento recusado na liquidação. |
| `order-timeout` | O pedido é criado, mas a resposta demora 15 s (cliente expira em 8 s e recupera pela mesma chave). |
| `wallet-rejected` | Conexão de carteira recusada. |
| `short-session` | Sessões expiram em 60 s. |

## Reproduzindo fluxos de falha

Rotas de controle (só existem no MSW) podem ser chamadas pelo console do navegador, por exemplo:

```js
const call = (path, body) => fetch(`/api/__mock${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
await call('/nfts/nft-005', { editions: [{ id: 'nft-005-1-50', price: '1.50', available: 2 }] }) // preço/estoque → nft.updated
await call('/sessions/expire')            // expira sessões ativas
await call('/events/replay', { count: 2 }) // reenvia eventos (duplicados/antigos)
await call('/socket/drop')                 // derruba o Socket.IO (reconexão automática)
```

1. **Preço alterado no checkout**: entre como Ana, adicione `Violet Nomad #314`, vá a Pagamento, conecte a carteira e clique em *Revisar pedido*. Rode a 1ª linha acima: o resumo muda, a confirmação é bloqueada e é preciso *Revisar novamente*.
2. **Edição esgotada**: com o item no carrinho, envie `available: 0`: o carrinho mostra a edição esgotada e bloqueia a finalização.
3. **Pagamento recusado**: `/?__scenario=payment-declined` e conclua uma compra; os itens permanecem no carrinho.
4. **Timeout com idempotência**: `/?__scenario=order-timeout`; ao confirmar, a primeira resposta expira e o retry com a mesma `Idempotency-Key` recupera o mesmo pedido. Recarregar a página do pedido não cria outro.
5. **Pedido pendente + desconexão**: no cenário `default`, confirme e, ainda pendente, rode `/socket/drop`; após reconectar, o estado é reconciliado via REST.
6. **Sessão expirada**: rode `/sessions/expire` em Pagamento e recarregue: login com retorno ao checkout e rascunho preservado.
7. **Falhas de carregamento**: `catalog-error`, `offline`, `slow`, `empty-catalog`.

## Testes

`npm run test:e2e` executa 52 testes (26 por projeto) com estado isolado (`__reset` + cenário por teste), cobrindo busca/filtros/histórico, detalhe inexistente, cadastro/conflito, login/expiração/troca de usuário, favoritos com rollback, carrinho/cupons, compra completa, recusa, clique repetido, timeout, perfil/avatar/senha/carteiras, tempo real (preço, estoque, eventos duplicados, reconexão), teclado/foco e skeletons. Os testes de tempo real disparam eventos pela rota de controle do MSW e observam a UI atualizada via `socket.io-client`; a regressão visual cobre início, detalhe, carrinho e pagamento em desktop e mobile.

As baselines visuais (`e2e/visual.spec.ts-snapshots/*-win32.png`) foram geradas em Windows; em outro SO, gere as próprias com `--update-snapshots`.

## Deploy (Vercel)

`vercel.json` define `npm ci`, `npm run build`, saída `dist/`, rewrite de SPA (arquivos estáticos têm precedência, então `mockServiceWorker.js`, `assets/` e `images/` são servidos diretamente) e cabeçalhos de cache. Mocks e Socket.IO simulado ficam ativos via `.env`.

```sh
npm i -g vercel      # ou npx vercel
vercel login
vercel               # cria/vincula o projeto (framework Vite detectado) e publica um preview
vercel --prod        # publica em produção
```

Alternativa sem CLI: importar o repositório em vercel.com/new (as configurações vêm do `vercel.json`).
