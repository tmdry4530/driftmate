import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { App } from './App.js'
import { loadConfig } from './config.js'
import { buildWagmiConfig } from './wagmi.js'
import './styles.css'

const root = createRoot(document.getElementById('root')!)

try {
  const config = loadConfig()
  const wagmiConfig = buildWagmiConfig(config)
  const queryClient = new QueryClient()
  const keeperUrl = import.meta.env.VITE_KEEPER_URL as string | undefined

  root.render(
    <StrictMode>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <App config={config} keeperUrl={keeperUrl} />
        </QueryClientProvider>
      </WagmiProvider>
    </StrictMode>,
  )
} catch (e) {
  root.render(
    <div className="app">
      <div className="notice">
        <strong>설정이 필요해요.</strong>
        <p style={{ margin: '8px 0 0' }}>
          {e instanceof Error ? e.message : '알 수 없는 오류'}
          <br />
          <code>apps/web/.env.example</code>을 <code>.env</code>로 복사한 뒤 배포한 주소를 채워 주세요.
        </p>
      </div>
    </div>,
  )
}
