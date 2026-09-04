import type { Address } from '@soon/shared'

/**
 * All chain and contract settings come from environment values (R1.4).
 *
 * Hard-coded chain IDs or addresses would require code changes for another EVM.
 * Environment-only configuration keeps the deployment chain-neutral.
 */
export type AppConfig = Readonly<{
  chainId: number
  chainName: string
  rpcUrl: string
  vault: Address
  dex: Address
  token: Address
  quote: Address
  /** Automatic executor. The vault accepts execution only from this address. */
  executor: Address
  /** Optional explorer used for track-record transaction links. Absent on local chains. */
  explorerUrl?: string
}>

function required(key: string): string {
  const v = import.meta.env[key] as string | undefined
  if (!v) throw new Error(`Environment variable ${key} is not configured.`)
  return v
}

export function loadConfig(): AppConfig {
  return {
    chainId: Number(required('VITE_CHAIN_ID')),
    chainName: required('VITE_CHAIN_NAME'),
    rpcUrl: required('VITE_RPC_URL'),
    vault: required('VITE_VAULT_ADDRESS') as Address,
    dex: required('VITE_DEX_ADDRESS') as Address,
    token: required('VITE_TOKEN_ADDRESS') as Address,
    quote: required('VITE_QUOTE_ADDRESS') as Address,
    executor: required('VITE_EXECUTOR_ADDRESS') as Address,
    ...(import.meta.env['VITE_EXPLORER_URL']
      ? { explorerUrl: import.meta.env['VITE_EXPLORER_URL'] }
      : {}),
  }
}
