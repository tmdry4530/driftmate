import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const root = createRoot(document.getElementById('root')!)

async function start() {
  if (import.meta.env.VITE_APP_MODE !== 'base') {
    const [{ Buffer }, { MidnightApp }] = await Promise.all([
      import('buffer'),
      import('./MidnightApp.js'),
    ])
    globalThis.Buffer = Buffer
    root.render(<StrictMode><MidnightApp /></StrictMode>)
    return
  }

  try {
    const [reactQuery, wagmi, appModule, configModule, wagmiModule] = await Promise.all([
      import('@tanstack/react-query'),
      import('wagmi'),
      import('./App.js'),
      import('./config.js'),
      import('./wagmi.js'),
    ])
    const config = configModule.loadConfig()
    const wagmiConfig = wagmiModule.buildWagmiConfig(config)
    const queryClient = new reactQuery.QueryClient()
    const keeperUrl = import.meta.env.VITE_KEEPER_URL as string | undefined
    root.render(
      <StrictMode>
        <wagmi.WagmiProvider config={wagmiConfig}>
          <reactQuery.QueryClientProvider client={queryClient}>
            <appModule.App config={config} keeperUrl={keeperUrl} />
          </reactQuery.QueryClientProvider>
        </wagmi.WagmiProvider>
      </StrictMode>,
    )
  } catch (error) {
    root.render(
      <div className="app">
        <div className="notice">
          <strong>설정이 필요해요.</strong>
          <p style={{ margin: '8px 0 0' }}>
            {error instanceof Error ? error.message : '알 수 없는 오류'}
            <br />
            <code>apps/web/.env.example</code>을 <code>.env</code>로 복사한 뒤 배포한 주소를 채워 주세요.
          </p>
        </div>
      </div>,
    )
  }
}

void start()
