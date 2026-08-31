import { describe, expectTypeOf, it } from 'vitest'
import type {
  Bps,
  CostEstimate,
  DecisionEvidence,
  DecisionInput,
  Holding,
  PriceSnapshot,
  SignedLimits,
  StrategyParams,
  TargetWeight,
  TrackRecord,
  TrustResult,
} from '@soon/shared'

/** union의 모든 멤버가 가진 키를 합집합으로 모은다. */
type AllKeys<T> = T extends unknown ? keyof T : never

describe('타입 제약 — 요구사항을 구조로 강제한다', () => {
  it('DecisionInput에 신뢰 관련 필드가 없다 (R4.8)', () => {
    // 타입에 자리가 없으면 신뢰가 거래 판단에 영향을 줄 방법이 존재하지 않는다.
    expectTypeOf<
      Extract<
        keyof DecisionInput,
        'trust' | 'trustScore' | 'score' | 'discretion' | 'discretionCap'
      >
    >().toEqualTypeOf<never>()
  })

  it('TrackRecord에 상호작용·결제 기록이 없다 (R10.3)', () => {
    // 신뢰는 오직 이 목록으로 계산되므로, 여기 없는 것은 신뢰에 영향을 줄 수 없다.
    expectTypeOf<
      Extract<
        AllKeys<TrackRecord>,
        | 'sessionCount'
        | 'loginCount'
        | 'interactionCount'
        | 'paymentHistory'
        | 'purchases'
        | 'visits'
      >
    >().toEqualTypeOf<never>()
  })

  it('금액은 전부 bigint다', () => {
    expectTypeOf<CostEstimate['gasValue']>().toEqualTypeOf<bigint>()
    expectTypeOf<CostEstimate['slippageValue']>().toEqualTypeOf<bigint>()
    expectTypeOf<CostEstimate['operatingValue']>().toEqualTypeOf<bigint>()
    expectTypeOf<Holding['amount']>().toEqualTypeOf<bigint>()
    expectTypeOf<SignedLimits['maxTradeValue']>().toEqualTypeOf<bigint>()
    expectTypeOf<SignedLimits['autoThreshold']>().toEqualTypeOf<bigint>()
    expectTypeOf<SignedLimits['budget']>().toEqualTypeOf<bigint>()
    expectTypeOf<SignedLimits['budgetSpent']>().toEqualTypeOf<bigint>()
  })

  it('신뢰 재량이 절대 금액이 아니라 비율이다 (R5.7)', () => {
    // 비율이면 사용자 상한에 곱해지므로 10000bp를 넘지 않는 한 상한을 넘을 수 없다.
    // 절대 금액이었다면 게이트가 min을 직접 계산해야 하고 거기서 실수할 여지가 생긴다.
    expectTypeOf<TrustResult['discretionBps']>().toEqualTypeOf<Bps>()
    expectTypeOf<
      Extract<keyof TrustResult, 'discretionCap' | 'cap' | 'maxValue'>
    >().toEqualTypeOf<never>()
  })

  it('가격은 고정소수 bigint다', () => {
    expectTypeOf<PriceSnapshot['prices'][number]['priceE18']>().toEqualTypeOf<bigint>()
    expectTypeOf<PriceSnapshot['blockNumber']>().toEqualTypeOf<bigint>()
  })

  it('비율은 Bps 브랜드이고 맨 number가 아니다', () => {
    // 브랜드가 없으면 소수를 넣을 수 있고, 반올림 차이가 결정론을 깬다.
    expectTypeOf<StrategyParams['bandBps']>().toEqualTypeOf<Bps>()
    expectTypeOf<StrategyParams['bandBps']>().not.toEqualTypeOf<number>()
    expectTypeOf<TargetWeight['bps']>().toEqualTypeOf<Bps>()
    expectTypeOf<TargetWeight['bps']>().not.toEqualTypeOf<number>()
    expectTypeOf<DecisionEvidence['driftBps']>().toEqualTypeOf<Bps>()
  })

  it('DecisionEvidence에 실행 정보가 없다 (R8.1)', () => {
    // Narrator가 보는 전부. 거래 내역·주소·원금액이 없어야 LLM이 실행을 알 수 없다.
    expectTypeOf<
      Extract<
        keyof DecisionEvidence,
        'trades' | 'amountIn' | 'amountOut' | 'vault' | 'totalValue' | 'id'
      >
    >().toEqualTypeOf<never>()
  })
})
