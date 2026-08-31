import type { Address, Bps, CharacterId } from './primitives.js'

export type Holding = Readonly<{
  asset: Address
  amount: bigint
  decimals: number
}>

export type TargetWeight = Readonly<{
  asset: Address
  bps: Bps
}>

/** 사용자가 정하는 목표 비중. 합은 10000bp여야 한다 (R3.1). */
export type PortfolioTarget = Readonly<{
  weights: readonly TargetWeight[]
}>

/** 밴드를 벗어났을 때 어디까지 되돌릴지. */
export type RebalanceStyle = 'to_target' | 'to_band_edge'

/**
 * 캐릭터가 소유하는 전략 파라미터.
 * 사용자가 런타임에 수정할 수 없다 (R2.4) — 성향을 바꾸려면 캐릭터를 바꿔야 한다.
 */
export type StrategyParams = Readonly<{
  characterId: CharacterId
  bandBps: Bps
  rebalanceStyle: RebalanceStyle
  minTradeValue: bigint
}>
