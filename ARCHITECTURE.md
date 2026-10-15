# Arquitetura

## Visão geral

```
src/
  contracts/      Tipos compartilhados por mocks, transporte, estado e UI (api.ts, events.ts)
  api/            Axios (client.ts), endpoints tipados e chaves/queryOptions do TanStack Query
  realtime/       socket.io-client (socket.ts) e aplicação idempotente de eventos no cache (apply.ts)
  hooks/          Mutations/consultas de domínio (auth, carrinho, favoritos, checkout)
  lib/            Sessão do cliente, aritmética ETH, tentativa de checkout, rótulos
  routes/         TanStack Router (file-based); _private/ exige sessão
  components/     UI (shadcn/ui em components/ui adaptado aos tokens do Figma)
  mocks/          MSW: estado persistente, fixtures, cenários, handlers REST e Socket.IO
```

Fluxo: **UI → hooks (TanStack Query) → Axios → MSW (REST)**; **MSW → evento Socket.IO → socket.io-client → cache do Query → UI**. Componentes, hooks e o cliente Axios não contêm respostas fictícias: todo dado e toda regra (cotação, estoque, idempotência, liquidação) vêm do MSW.

`main.tsx` baixa o app em paralelo e só renderiza depois de `worker.start()`. O `socket.io-client` é importado sob demanda dentro de `connectRealtime`: o `engine.io-client` captura `globalThis.WebSocket` ao ser avaliado e precisa encontrar o WebSocket já interceptado pelo MSW.

## Contratos REST

Base `/api`. Valores em ETH trafegam como **strings decimais** (`"1.19"`); quantidades são inteiras. A aritmética usa `bigint` em wei (`lib/eth.ts`), sem ponto flutuante. Erros seguem `{ code, message, fields?, quote? }`.

| Recurso | Operações |
| --- | --- |
| Sessão e conta | `POST /auth/register`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` |
| NFTs | `GET /nfts?q&categories&networks&minPrice&maxPrice&collection&favorites&tab&sort&page&pageSize` (arrays como parâmetros repetidos; resposta com facetas), `GET /nfts/featured`, `GET /nfts/:id` |
| Favoritos | `GET /favorites`, `PUT /favorites/:nftId`, `DELETE /favorites/:nftId` |
| Carrinho | `GET /cart?network`, `POST /cart/items`, `PATCH /cart/items/:lineId`, `DELETE /cart/items/:lineId`, `POST /cart/accept-prices`, `PUT /cart/coupon`, `DELETE /cart/coupon` |
| Cotação | Incluída em toda resposta do carrinho (`quote`: subtotal, desconto, taxa de rede, total, cupom, `issues` de estoque e `id` derivado do conteúdo) |
| Pedidos | `POST /orders` (cabeçalho `Idempotency-Key`), `GET /orders?status`, `GET /orders/:id` |
| Perfil | `GET /profile`, `PATCH /profile`, `PUT /profile/avatar` (data URL ≤ 512 KB), `DELETE /profile/avatar`, `POST /profile/password` |
| Carteiras | `GET /wallets`, `PUT /wallets/:slot` (`primary`/`secondary`), `POST /wallets/connect`, `GET /wallets/connection`, `DELETE /wallets/connection` |
| Controle (só mock) | `GET /__mock/scenario`, `POST /__mock/reset`, `POST /__mock/nfts/:id`, `POST /__mock/sessions/expire`, `POST /__mock/events/replay`, `POST /__mock/socket/drop` |

| Situação | Status / `code` |
| --- | --- |
| Validação | 422 `VALIDATION` (com `fields`), 400 para cabeçalhos/corpo inválidos |
| Sessão | 401 `UNAUTHENTICATED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS` |
| Permissão | 403 `WALLET_REJECTED`; pedido de outro usuário responde **404** para não revelar sua existência |
| Inexistente | 404 `NOT_FOUND` |
| Conflitos | 409 `CONFLICT` (cadastro/perfil), `AVAILABILITY_CONFLICT`, `QUOTE_CHANGED` (com a nova `quote`), `IDEMPOTENCY_CONFLICT`, `WALLET_DISCONNECTED` |
| Cupom | 422 `COUPON_INVALID`, `COUPON_EXPIRED` |
| Transitória | 500/503 `UNAVAILABLE`, erro de rede, timeout |

## Eventos Socket.IO

Envelope comum: `{ eventId, type, resource: { type, id }, version, occurredAt, data }`.

| Evento | Destino | `data` |
| --- | --- | --- |
| `nft.updated` | Todas as conexões | preço, preço anterior e `editions[{ id, price, available }]`; `version` = versão do NFT |
| `order.updated` | Apenas a conexão do dono (token no handshake) | snapshot completo do pedido; `version` = versão do pedido |

O cliente ignora `eventId` já visto e versões menores ou iguais à conhecida (`realtime/apply.ts`), e só aplica `order.updated` no cache do usuário da sessão atual. Mudanças nos dados simulados passam sempre pelo estado do MSW e geram REST e evento coerentes.

## Sessão

- Login/cadastro devolvem `{ token, expiresAt, user }`, guardado em `localStorage` e enviado como `Authorization: Bearer`. Senhas são armazenadas no mock como `SHA-256(salt:senha)`.
- Na carga, a sessão restaurada é revalidada (`GET /auth/session`). Qualquer 401 de sessão limpa a sessão local; o layout `_private` revalida a rota e o `beforeLoad` redireciona para `/entrar?redirect=<href>`, que após o login volta ao fluxo (o checkout mantém um rascunho em `sessionStorage`).
- Logout e troca de usuário: cancelam consultas, removem do cache tudo em `['user', id, ...]`, carrinho e sessão, e fecham o socket anterior (listeners liberados); um novo socket é aberto com o novo token.

## Carrinho

- Mantido no servidor simulado, por dono: `user:<id>` ou `guest:<X-Guest-Id>` (identificador gerado no cliente). Sobrevive a refresh; no login/cadastro os itens e o cupom do visitante são mesclados ao carrinho do usuário, respeitando os limites da edição.
- Cada linha guarda o preço aceito pelo usuário; quando `nft.updated` muda um preço, a cotação é recalculada pela API, a UI avisa (toast + aviso no carrinho) e a finalização exige *Aceitar novos preços*. Estoque insuficiente aparece em `quote.issues` e bloqueia a finalização.
- A cotação da API é a referência: o checkout envia o `quote.id` revisado; se preço, estoque, cupom ou taxa mudaram, o servidor responde `QUOTE_CHANGED` e a UI exige nova revisão (o mesmo vale quando o evento chega antes do envio).
- Após confirmação, o servidor remove do carrinho **apenas as quantidades compradas**; recusa e falhas preservam os itens.

## Pedidos, idempotência e reconciliação

- A tentativa (`{ key, body, orderId? }`) é persistida por usuário (`lib/checkout-attempt.ts`). Cliques repetidos, retries automáticos (timeout/rede/5xx, até 2) e refresh reutilizam a mesma `Idempotency-Key`; mesmo conteúdo devolve o mesmo pedido, conteúdo diferente com a mesma chave gera `IDEMPOTENCY_CONFLICT`. Pedido terminal encerra a tentativa.
- O pedido guarda um **snapshot imutável** das linhas e valores da cotação; o recibo não muda com alterações posteriores no catálogo.
- Liquidação simulada: `pending` → `confirmed` ou `declined` (terminais) após `paymentDelayMs`, publicada como `order.updated`. A confirmação só é exibida para `confirmed`.
- Recuperação: a página do pedido carrega por REST (refresh). Ao reconectar, o cliente invalida as consultas ativas e reconcilia via REST; `GET /orders/:id` liquida pedidos vencidos e o boot do MSW reagenda pendentes. Um aviso global mostra pedidos pendentes encontrados por `GET /orders?status=pending`.

## Cache, retries e sincronização (TanStack Query)

| Dado | Chave | Política |
| --- | --- | --- |
| Catálogo | `['nfts','list',params]` | `staleTime` 30 s, `keepPreviousData`, `AbortSignal` (respostas obsoletas descartadas pela chave) |
| Detalhe | `['nfts','detail',id]` | `staleTime` 30 s; atualizado por `nft.updated` |
| Carrinho | `['cart', dono, rede]` | `staleTime` 0; mutations gravam a resposta da API e invalidam as demais redes; eventos invalidam |
| Privados | `['user', id, ...]` | Isolados por usuário e removidos no logout/troca |

- Retries automáticos só para falhas transitórias (rede, timeout, 5xx), no máximo 2; 4xx nunca são repetidos. Mutations não repetem, exceto a criação de pedido (idempotente).
- Atualização otimista com rollback: favoritos.
- Busca, filtros, ordenação e página vivem na URL (validados em `routes/index.tsx`); filtro novo reinicia a paginação.

## Mocks (MSW)

- Estado único em `mocks/db.ts`, persistido em `localStorage` e sincronizado entre abas; fixtures determinísticas (2 usuários, 48 NFTs com 4 edições cada, cupons). Reset restaura o seed.
- Cenários (`mocks/scenarios.ts`): latência fixa ou determinística por URL, falhas por rota (rede, 500, 503, timeout) com contador, pagamento, timeout de pedido, conexão de carteira, catálogo vazio e TTL de sessão.

### Socket.IO com `@mswjs/socket.io-binding` 0.2.0

- **Transporte**: somente WebSocket (`transports: ['websocket']`). O long-polling HTTP do Engine.IO não é tratado pelo binding.
- **Versões**: o binding 0.2.0 exige `msw ^2.10.2`; o projeto fixa `msw@2.15.0` (msw 3 é incompatível). A API usada é `toSocketIo(connection)`; a API `SocketIo` do README da branch principal não foi publicada.
- O msw 2.15 remove o prefixo `/socket.io/` da URL antes de casar o handler; o `ws.link` usa apenas o host.
- O binding anuncia `pingInterval` mas não envia pings; o mock envia o ping do Engine.IO a cada 25 s para evitar `ping timeout`.
- Limitações: apenas o namespace `/`, eventos de texto, sem acknowledgements e sem anexos binários; `sid` fixo. Desconexão é simulada fechando o WebSocket (o cliente reconecta sozinho).
- O WebSocket só é interceptado na página (não no service worker); por isso o socket é criado depois de `worker.start()`.

## Acessibilidade

Link para pular conteúdo, foco visível, foco preso e devolvido em diálogos/drawers (Radix), rótulos e erros associados (`aria-describedby`/`aria-invalid`), `aria-pressed` em toggles, `aria-live` em preço/status e toasts, alvos de toque ≥ 24 px, `prefers-reduced-motion` desliga o shimmer e as animações, `scroll-padding` para a navegação inferior fixa não encobrir o foco. Toasts não bloqueiam cliques (o conteúdo continua anunciado).

## Performance (Lighthouse)

Medianas de 3 medições do build otimizado com o cenário padrão (ver `lighthouse/summary.md`):

| Página | Perfil | Perf. | A11y | BP | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | 80 | 100 | 100 | 100 | 4.00 s | 0.003 | 233 ms |
| Início | desktop | 98 | 100 | 100 | 100 | 1.10 s | 0.008 | 15 ms |
| Detalhe | mobile | 74 | 100 | 100 | 100 | 4.07 s | 0.002 | 356 ms |
| Detalhe | desktop | 97 | 100 | 100 | 100 | 1.15 s | 0.006 | 27 ms |

Correções aplicadas após a primeira auditoria: favicon ausente (erro de console), alvos de toque do carrossel, preload da arte principal (atraso de descoberta do LCP de ~940 ms para ~20 ms) e download do app em paralelo ao boot do MSW.

**Meta não atingida (Performance mobile ≥ 90)**: o LCP mobile é dominado pelo *render delay* (~0,85–1,1 s simulados). A imagem só é exibida depois que (1) o bundle do MSW é avaliado (~600–700 ms de script com CPU 4×), (2) o service worker é registrado num perfil limpo e (3) o catálogo responde com a latência de 250 ms do cenário padrão. São custos da exigência de mocks ativos no build público; desativá-los ou servir HTML pré-renderizado só para a auditoria foi evitado. Em produção com backend real, `VITE_ENABLE_MOCKS=false` elimina (1)–(3).

## Desvios do Figma e decisões de UX

- **Imagens**: não houve export de assets isolados. As quatro artes foram recortadas dos PNGs de `design-reference/` (emerald 420 px; golden/ivory/sage 230 px) e servidas localmente em `public/images/nfts/`; no detalhe ampliado as de 230 px perdem nitidez. Os 48 NFTs reutilizam as quatro artes.
- **Perfil**: o frame inclui "Nome ENS" e "Apelido da carteira", que são dados de carteira; ficaram apenas em Carteiras. O perfil traz nome de exibição, usuário, e-mail, bio, avatar e senha.
- **Pagamento mobile**: o frame mostra só carteira e total; os dados do colecionador (obrigatórios no enunciado) aparecem antes. Conexão/recusa/desconexão da carteira são explícitas (botão *Conectar carteira*). Há uma etapa de revisão antes de *Confirmar compra*.
- **Detalhe mobile**: a barra de compra fixa do frame foi substituída pela navegação inferior global; quantidade e *Comprar* ficam no conteúdo.
- **Login/Cadastro**: diálogo sobre o Início (desktop) e tela cheia (mobile), com rotas próprias (`/entrar`, `/cadastro`).
- **Confirmação**: rota `/pedidos/:id` exibe pendente, recusado ou o recibo; o link do Etherscan é simulado.
- **Fora do escopo** (Criadores, Aprenda, newsletter, login social, recuperação de senha, leitor de QR, conteúdo editorial, Atividade/Ofertas/Arquivos/Suporte): exibem aviso de indisponibilidade, nunca sucesso. Redes sociais e compartilhamento são links externos reais.
- Ícones de redes sociais usam texto (lucide não traz marcas).

## Testes

Playwright em Chromium (desktop 1440×900 e Pixel 7), cada teste com `__reset` + cenário próprio. REST passa pelos handlers MSW via service worker; tempo real via `socket.io-client` (eventos disparados pelas rotas de controle e observados na UI). Tempo e latência são controlados por cenários (`fast`, `slow`, `order-timeout` etc.) e o disparo de eventos é explícito. Relatório HTML em `playwright-report/`; traces e screenshots de falhas em `test-results/`. Regressão visual com baselines versionadas, inspecionadas e comparadas aos exports do Figma (Windows; `maxDiffPixelRatio` 1%).
