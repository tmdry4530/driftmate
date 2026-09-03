import type {
  Address,
  Bps,
  Bytes32,
  DecisionEvidence,
  DecisionId,
  PendingDecision,
  PortfolioBaseline,
  TradeIntent,
} from '@soon/shared'

export type OnChainDelegation = Readonly<{
  delegationId: bigint
  configHash: Bytes32
  stateNonce: bigint
  executor: Address
  characterId: string
  strategyHash: Bytes32
  trustFormulaVersion: number
  quoteAsset: Address
  maxTradeValue: bigint
  autoThreshold: bigint
  budget: bigint
  budgetSpent: bigint
  operatingCap: bigint
  operatingSpent: bigint
  expiry: bigint
  approvalTtlSeconds: bigint
  slippageToleranceBps: Bps
  targetAsset: Address
  targetAssetBps: Bps
  allowedAssets: readonly Address[]
  allowedDexes: readonly Address[]
}>

export interface ChainReader {
  getBlockNumber(): Promise<bigint>
  getBlockTimestamp(blockNumber: bigint): Promise<bigint>
  readSpotPriceE18(pool: Address, asset: Address, blockNumber: bigint): Promise<bigint>
  readAmountOut(pool: Address, tokenIn: Address, amountIn: bigint, blockNumber: bigint): Promise<bigint>
  readBalance(token: Address, account: Address, blockNumber: bigint): Promise<bigint>
  readDelegation(vault: Address, blockNumber: bigint): Promise<OnChainDelegation>
  readPortfolioBaseline(vault: Address, blockNumber: bigint): Promise<PortfolioBaseline>
  readPendingDecision(vault: Address, blockNumber: bigint): Promise<PendingDecision>
  readPendingRequest(vault: Address, pending: PendingDecision, blockNumber: bigint): Promise<PendingRequest | undefined>
  readNarrationCostRecorded(
    vault: Address,
    delegationId: bigint,
    decisionId: DecisionId,
    blockNumber: bigint,
  ): Promise<boolean>
}

export type DecisionWrite = Readonly<{
  vault: Address
  delegationId: bigint
  stateNonce: bigint
  decisionId: DecisionId
  evidence: `0x${string}`
  priceCost: bigint
}>

export type PendingRequest = Readonly<{
  blockNumber: bigint
  dex: Address
  trade: TradeIntent
  evidence: DecisionEvidence
}>

export interface VaultWriter {
  executeAuto(args: DecisionWrite & { dex: Address; trade: TradeIntent }): Promise<`0x${string}`>
  propose(args: DecisionWrite & { dex: Address; trade: TradeIntent }): Promise<`0x${string}`>
  recordNotExecuted(args: DecisionWrite & { reason: number }): Promise<`0x${string}`>
  expire(args: {
    vault: Address
    delegationId: bigint
    stateNonce: bigint
    decisionId: DecisionId
  }): Promise<`0x${string}`>
  chargeNarrationCost(args: {
    vault: Address
    delegationId: bigint
    amount: bigint
    decisionId: DecisionId
  }): Promise<`0x${string}`>
}
