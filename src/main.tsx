async function boot() {
  // App e mocks baixam em paralelo; a renderização só ocorre com o MSW ativo.
  // O socket.io-client é importado sob demanda (realtime/socket.ts), depois do MSW:
  // o engine.io-client captura `globalThis.WebSocket` ao ser avaliado.
  const app = import('./app')
  if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  const { renderApp } = await app
  renderApp()
}

void boot()
