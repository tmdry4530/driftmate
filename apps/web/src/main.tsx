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
        <strong>Configuration required.</strong>
        <p style={{ margin: '8px 0 0' }}>
          {e instanceof Error ? e.message : 'Unknown error'}
          <br />
          Copy <code>apps/web/.env.example</code> to <code>.env</code>, then add the deployed addresses.
        </p>
      </div>
    </div>,
  )
}
