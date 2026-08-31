import type { Address, CharacterId, DecisionId } from './primitives.js'
import type { DecisionEvidence } from './decision.js'

export type NotExecutedReason =
  | 'rejected'
  | 'expired'
  | 'cost_exceeds_benefit'
  | 'slippage'
  | 'stale_price'
  | 'budget_exhausted'

export type CostKind = 'price_data' | 'narration'

/**
 * 온체인 이벤트를 그대로 옮긴 트랙레코드 항목.
 *
 * 접속 횟수·상호작용 빈도·결제 이력에 해당하는 변형이 없다 — R10.3을 타입으로 막는다.
 * 신뢰 점수는 이 목록만을 입력으로 계산된다 (R10.1).
 */
/** 온체인에서 이 기록을 직접 확인할 수 있는 참조 (R7.5). */
export type TxRef = Readonly<{ txHash?: `0x${string}` }>

export type TrackRecord =
  | Readonly<{
      kind: 'decided'
      decisionId: DecisionId
      characterId: CharacterId
      blockNumber: bigint
      evidence: DecisionEvidence
    }> & TxRef
  | Readonly<{
      kind: 'executed'
      decisionId: DecisionId
      blockNumber: bigint
      tokenIn: Address
      tokenOut: Address
      amountIn: bigint
      amountOut: bigint
      /** 거래 규모 (quote 자산 기준). 마찰비용을 재는 분모다. */
      valueQuote: bigint
      /**
       * 이 거래에서 새어나간 값 — 슬리피지와 수수료 (quote 기준, 양수).
       *
       * 리밸런싱 스왑은 자산 교환이라 그 자체로 손익이 없다. 캐릭터가 실제로
       * 통제하는 것은 "얼마나 싸게 옮겼는가"이고, 시장이 오르내린 결과는
       * 캐릭터의 성과가 아니다. 그래서 성과를 수익이 아니라 마찰로 잰다.
       */
      frictionQuote: bigint
    }> & TxRef
  | Readonly<{
      kind: 'not_executed'
      decisionId: DecisionId
      blockNumber: bigint
      reason: NotExecutedReason
    }> & TxRef
  | Readonly<{
      kind: 'cost'
      decisionId: DecisionId
      blockNumber: bigint
      amount: bigint
      costKind: CostKind
    }> & TxRef
  | Readonly<{
      kind: 'disappointed'
      blockNumber: bigint
    }> & TxRef
