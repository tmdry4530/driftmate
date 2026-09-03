import type { Bps, DecisionId, FormulaVersion, Int, Score } from './primitives.js'

export type Contribution = Readonly<{
  delegationId: bigint
  decisionId?: DecisionId
  blockNumber: bigint
  delta: Int
  reason: string
}>

/**
 * 신뢰 계산 결과 (R10).
 *
 * 재량을 절대 금액이 아니라 사용자 상한 대비 비율로 표현한다.
 * 10000bp를 넘지 않으므로 "신뢰가 아무리 높아도 사용자 상한을 못 넘는다"(R5.7)가
 * 게이트의 계산 실수와 무관하게 구조로 보장된다.
 * 볼트는 이 값을 알지 못한다 (ADR-0003).
 */
export type TrustResult = Readonly<{
  score: Score
  discretionBps: Bps
  contributions: readonly Contribution[]
  formulaVersion: FormulaVersion
}>
