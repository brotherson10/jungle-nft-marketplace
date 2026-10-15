import { HttpResponse } from 'msw'
import type { Edition, Eth } from '@/contracts/api'
import { isEth } from '@/lib/eth'
import { db, reset, save } from '../db'
import { fail, readJson, route } from '../http'
import { dropConnections, publishNft, replay } from '../realtime'
import { isScenarioName, scenarioPresets, type Scenario } from '../scenarios'

/**
 * Controle da simulação (demo e testes). Toda mudança passa pelo estado do MSW
 * e é refletida nas respostas REST e nos eventos Socket.IO.
 */
export const controlHandlers = [
  route('get', '/__mock/scenario', () =>
    HttpResponse.json({ name: db.scenarioName, scenario: db.scenario, available: Object.keys(scenarioPresets) }),
  ),

  route('post', '/__mock/reset', async ({ request }) => {
    const { scenario = 'default', overrides } = await readJson<{ scenario: string; overrides: Partial<Scenario> }>(request)
    if (!isScenarioName(scenario)) return fail(422, 'VALIDATION', `Cenário desconhecido: ${scenario}`)
    reset(scenario, overrides)
    return HttpResponse.json({ name: db.scenarioName, scenario: db.scenario })
  }),

  /** Altera preço/disponibilidade de um NFT (simula outro comprador ou o criador). */
  route<{ id: string }>('post', '/__mock/nfts/:id', async ({ request, params }) => {
    const nft = db.nfts.find((n) => n.id === params.id)
    if (!nft) return fail(404, 'NOT_FOUND', 'NFT não encontrado.')
    const body = await readJson<{ editions: { id: string; price?: Eth; available?: number }[] }>(request)
    for (const change of body.editions ?? []) {
      const edition: Edition | undefined = nft.editions.find((e) => e.id === change.id)
      if (!edition) return fail(404, 'NOT_FOUND', `Edição ${change.id} não encontrada.`)
      if (change.price !== undefined) {
        if (!isEth(change.price)) return fail(422, 'VALIDATION', 'Preço inválido.')
        edition.price = change.price
      }
      if (change.available !== undefined) edition.available = Math.max(0, Math.trunc(change.available))
    }
    // O preço de vitrine acompanha a edição 1/50 (padrão do layout).
    nft.price = nft.editions.find((e) => e.label === '1/50')?.price ?? nft.price
    publishNft(nft)
    return HttpResponse.json(nft)
  }),

  /** Expira as sessões ativas (todas ou de um usuário). */
  route('post', '/__mock/sessions/expire', async ({ request }) => {
    const { userId } = await readJson<{ userId: string }>(request)
    db.sessions.forEach((s) => {
      if (!userId || s.userId === userId) s.expiresAt = Date.now() - 1
    })
    save()
    return new HttpResponse(null, { status: 204 })
  }),

  route('post', '/__mock/events/replay', async ({ request }) => {
    const { count = 1 } = await readJson<{ count: number }>(request)
    return HttpResponse.json({ replayed: replay(count) })
  }),

  route('post', '/__mock/socket/drop', () => HttpResponse.json({ dropped: dropConnections() })),
]
