import { defineChain, http } from 'viem'
import { createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import type { AppConfig } from './config.js'

/** Build the chain from configuration; never hard-code a specific chain (R1.4). */
export function buildWagmiConfig(cfg: AppConfig) {
  const chain = defineChain({
    id: cfg.chainId,
    name: cfg.chainName,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  })

  return createConfig({
    chains: [chain],
    connectors: [injected()],
    transports: { [chain.id]: http(cfg.rpcUrl) },
  })
}
