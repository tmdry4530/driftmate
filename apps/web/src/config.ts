import type { Address } from '@soon/shared'

/**
 * 체인·컨트랙트 설정은 전부 환경값에서 온다 (R1.4).
 *
 * 코드에 체인 ID나 주소를 박아두면 다른 EVM에 올릴 때 코드를 고쳐야 하고,
 * 그 순간 "체인 중립"이 말뿐이 된다. 설정만 바꿔 배포되는 상태를 유지한다.
 */
export type AppConfig = Readonly<{
  chainId: number
  chainName: string
  rpcUrl: string
  vault: Address
  dex: Address
  token: Address
  quote: Address
  /** 자동 실행을 수행하는 주소. 볼트는 이 주소만 실행자로 인정한다. */
  executor: Address
  /** 있으면 트랙레코드에서 트랜잭션으로 링크한다. 로컬 체인에는 없다. */
  explorerUrl?: string
}>

function required(key: string): string {
  const v = import.meta.env[key] as string | undefined
  if (!v) throw new Error(`환경변수 ${key}가 설정되지 않았다`)
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
