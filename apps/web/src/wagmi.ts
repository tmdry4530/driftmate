import { defineChain, http } from 'viem'
import { createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import type { AppConfig } from './config.js'

/** 설정값으로 체인을 만든다. 특정 체인을 코드에 박지 않는다 (R1.4). */
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
