import type { DecisionEvidence, TradeIntent } from './decision.js'
import type { CapSource } from './gate.js'
import type { Address, Bps, Bytes32, CharacterId, DecisionId } from './primitives.js'
import type { Narration } from './narration.js'

export type Delegation = Readonly<{
  executor: Address
  characterId: CharacterId
  strategyHash: Bytes32
  trustFormulaVersion: number
  quoteAsset: Address
  maxTradeValue: bigint
  autoThreshold: bigint
  budget: bigint
  operatingCap: bigint
  expiry: bigint
  approvalTtlSeconds: bigint
  slippageToleranceBps: Bps
  targetAsset: Address
  targetAssetBps: Bps
  allowedAssets: readonly Address[]
  allowedDexes: readonly Address[]
}>

export type DelegationState = Readonly<{
  delegationId: bigint
  configHash: Bytes32
  stateNonce: bigint
  budgetSpent: bigint
  operatingSpent: bigint
  delegation: Delegation
}>

export type DelegationDecisionKey = Readonly<{
  delegationId: bigint
  decisionId: DecisionId
}>

export type PendingDecision = DelegationDecisionKey &
  Readonly<{
    proposalNonce: bigint
    orderHash: Bytes32
    evidenceHash: Bytes32
    expiresAt: bigint
    open: boolean
  }>

export type PortfolioBaseline = Readonly<{
  delegationId: bigint
  characterId: CharacterId
  quoteAsset: Address
  pricingDex: Address
  targetAsset: Address
  targetBalance: bigint
  quoteBalance: bigint
  targetPriceE18: bigint
  valueQuote: bigint
  blockNumber: bigint
}>

export type PendingView = Readonly<{
  delegationId: string
  configHash: Bytes32
  stateNonce: string
  decisionId: DecisionId
  dex: Address
  trade: TradeIntent
  evidence: DecisionEvidence
  expiresAt: string
  effectiveCap: string
  overBy: string
  capSource: CapSource
}>

export type NarrationView = Narration &
  Readonly<{
    delegationId: string
    configHash: Bytes32
    decisionId: DecisionId
  }>

export type LossReport = Readonly<{
  delegationId: string
  configHash: Bytes32
  reportId: Bytes32
  baselineBlock: string
  currentBlock: string
  baselineValueQuote: string
  currentValueQuote: string
  operatingSpent: string
  pnlQuote: string
  pnlBps: Bps
  priceSource: Address
  status: 'loss' | 'not_loss' | 'cashflow_unknown'
}>

export type KeeperStatus = Readonly<{
  phase: 'idle' | 'deciding' | 'awaiting_approval'
  delegationId: string | null
  configHash: Bytes32 | null
  pending?: PendingView
  lastDecision?: Readonly<{
    delegationId: string
    configHash: Bytes32
    decisionId: DecisionId
    outcome: 'executed' | 'held' | 'skipped'
  }>
  snapshot?: Readonly<{
    delegationId: string
    configHash: Bytes32
    blockNumber: string
    targetBalance: string
    quoteBalance: string
    targetPriceE18: string
    valueQuote: string
  }>
  narration?: NarrationView
  lossReport?: LossReport
  lastError?: string
}>
