import type { Address, Bps, CharacterId, DecisionId } from './primitives.js'
import type { Holding, PortfolioTarget, StrategyParams } from './portfolio.js'
import type { PriceSnapshot } from './price.js'

export type CostEstimate = Readonly<{
  gasValue: bigint
  slippageValue: bigint
  /** 이 판단을 내리는 데 든 운영비 (R4.7, R11.5). */
  operatingValue: bigint
}>

/**
 * 판단 함수의 전체 입력.
 *
 * 신뢰 점수 필드가 없다는 것이 R4.8의 구현이다.
 * 타입에 자리가 없으므로 신뢰가 거래 판단에 영향을 줄 방법이 존재하지 않는다.
 */
export type DecisionInput = Readonly<{
  target: PortfolioTarget
  strategy: StrategyParams
  holdings: readonly Holding[]
  price: PriceSnapshot
  costEstimate: CostEstimate
  /** 스냅샷 만료 판정용. 시계를 읽는 대신 입력으로 받는다 (R4.5). */
  currentBlock: bigint
  /** 사용자가 정한 슬리피지 허용치. minAmountOut 산출에 쓰인다 (R6.4). */
  slippageToleranceBps: Bps
}>

export type TradeIntent = Readonly<{
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  minAmountOut: bigint
}>

export type DecisionKind = 'rebalance' | 'hold' | 'skip'

export type SkipReason =
  | 'within_band'
  | 'cost_exceeds_benefit'
  | 'stale_price'
  | 'below_min_trade'

export type Outcome = 'executed' | 'held' | 'asked' | 'skipped'

export type WeightSnapshot = Readonly<{
  asset: Address
  currentBps: Bps
  targetBps: Bps
}>

/**
 * Narrator에게 넘기는 읽기 전용 근거 (R8.1).
 * 거래 내역·볼트 주소·금액이 들어 있지 않아 LLM이 실행 정보를 볼 수 없다.
 */
export type DecisionEvidence = Readonly<{
  weights: readonly WeightSnapshot[]
  driftBps: Bps
  bandBps: Bps
  outcome: Outcome
  pnlBps?: Bps
  costBps?: Bps
}>

export type Decision = Readonly<{
  /** 입력 전체의 결정론적 해시. 볼트가 이 값으로 중복 실행을 막는다 (R6.6). */
  id: DecisionId
  kind: DecisionKind
  characterId: CharacterId
  trades: readonly TradeIntent[]
  totalValue: bigint
  evidence: DecisionEvidence
  skipReason?: SkipReason
}>
