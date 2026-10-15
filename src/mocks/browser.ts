import { setupWorker } from 'msw/browser'
import { db, reset, save } from './db'
import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { cartHandlers } from './handlers/cart'
import { catalogHandlers } from './handlers/catalog'
import { controlHandlers } from './handlers/control'
import { orderHandlers, resumePendingOrders } from './handlers/orders'
import { isScenarioName, resolveScenario } from './scenarios'
import { socketHandlers } from './socket'

/**
 * Seleção de cenário pela URL (demo e testes):
 *   ?__scenario=<nome>  troca o cenário mantendo os dados
 *   ?__reset=1          restaura o seed (com o cenário informado ou o atual)
 */
function applyUrlControls(): void {
  const url = new URL(window.location.href)
  const scenario = url.searchParams.get('__scenario')
  const shouldReset = url.searchParams.has('__reset')
  if (!scenario && !shouldReset) return
  if (shouldReset) {
    reset(scenario && isScenarioName(scenario) ? scenario : undefined)
    // Sessão e carrinho do cliente pertencem ao cenário anterior.
    localStorage.removeItem('kurio.session')
  } else if (scenario && isScenarioName(scenario)) {
    db.scenarioName = scenario
    db.scenario = resolveScenario(scenario)
    db.failureHits = {}
    save()
  }
  url.searchParams.delete('__scenario')
  url.searchParams.delete('__reset')
  window.history.replaceState(null, '', url)
}

export async function startMocks(): Promise<void> {
  applyUrlControls()
  const worker = setupWorker(
    ...controlHandlers,
    ...authHandlers,
    ...catalogHandlers,
    ...cartHandlers,
    ...orderHandlers,
    ...accountHandlers,
    ...socketHandlers,
  )
  await worker.start({ onUnhandledRequest: 'bypass', quiet: import.meta.env.PROD })
  resumePendingOrders()
}
