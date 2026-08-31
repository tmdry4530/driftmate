import type { Address } from './primitives.js'

/** 사용자가 서명한 절대 상한. 신뢰가 아무리 높아도 이것을 넘지 못한다 (R5.7). */
export type SignedLimits = Readonly<{
  maxTradeValue: bigint
  autoThreshold: bigint
  /** 거래와 운영비가 공유하는 단일 예산 (R3.7). */
  budget: bigint
  budgetSpent: bigint
  /** 위임 만료 시각(초). 볼트가 block.timestamp로 재므로 블록 번호가 아니다. */
  expiry: bigint
  allowedAssets: readonly Address[]
  allowedDexes: readonly Address[]
}>

export type CapSource = 'user' | 'trust'

export type RejectReason =
  | 'exceeds_hard_cap'
  | 'expired'
  | 'asset_not_allowed'
  | 'budget_exhausted'

export type GateResult =
  | Readonly<{ action: 'auto'; effectiveCap: bigint; capSource: CapSource }>
  | Readonly<{
      action: 'ask'
      overBy: bigint
      effectiveCap: bigint
      capSource: CapSource
    }>
  | Readonly<{ action: 'reject'; reason: RejectReason }>
