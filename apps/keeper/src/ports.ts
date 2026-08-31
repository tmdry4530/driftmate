import type { Address, CostKind, DecisionId, TradeIntent } from '@soon/shared'

/**
 * 체인과 이야기하는 통로를 좁은 인터페이스로 끊어 둔다.
 *
 * 파이프라인 로직이 viem을 직접 알지 않게 해서, 테스트에서 체인 없이 전체 흐름을
 * 돌릴 수 있고 다른 클라이언트로 교체해도 로직이 그대로 남는다.
 */
export interface ChainReader {
  getBlockNumber(): Promise<bigint>
  /** 현재 블록의 시각(초). 볼트가 만료를 block.timestamp로 재므로 필요하다. */
  getBlockTimestamp(): Promise<bigint>
  readSpotPriceE18(pool: Address, asset: Address): Promise<bigint>
  readBalance(token: Address, account: Address): Promise<bigint>
  readDelegation(vault: Address): Promise<OnChainDelegation>
  readBudgetSpent(vault: Address): Promise<bigint>
}

export interface OnChainDelegation {
  executor: Address
  quoteAsset: Address
  maxTradeValue: bigint
  autoThreshold: bigint
  budget: bigint
  expiry: bigint
  allowedAssets: readonly Address[]
  allowedDexes: readonly Address[]
}

export interface VaultWriter {
  execute(args: {
    vault: Address
    dex: Address
    trade: TradeIntent
    decisionId: DecisionId
    characterId: string
    evidence: `0x${string}`
  }): Promise<`0x${string}`>

  chargeCost(args: {
    vault: Address
    amount: bigint
    decisionId: DecisionId
    kind: CostKind
  }): Promise<`0x${string}`>

  recordNotExecuted(args: {
    vault: Address
    decisionId: DecisionId
    characterId: string
    evidence: `0x${string}`
    reason: number
  }): Promise<`0x${string}`>
}
