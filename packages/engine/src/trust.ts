import type {
  CharacterId,
  Contribution,
  FormulaVersion,
  TrackRecord,
  TrustResult,
} from '@soon/shared'
import { bps, int, score } from './brand.js'

export const TRUST_FORMULA_VERSION: FormulaVersion = 'v1'

/**
 * 점수 가감 폭.
 *
 * 나쁜 실행이 좋은 실행보다 크게 깎이는 것은 의도다 — 재량은 쉽게 넓어지면 안 된다.
 * 실망 표시는 한 번에 가장 크게 깎이고, 이후 실적으로만 되돌아온다 (R10.7).
 */
const WEIGHTS = {
  efficient: 3,
  wasteful: -5,
  rejected: -2,
  budgetExhausted: -3,
  disappointed: -15,
} as const

/**
 * 순성과를 재는 기준 — 거래 규모 대비 마찰비용(슬리피지 + 운영비) 비율.
 *
 * 0.5% 이내면 잘 옮긴 것, 1.5%를 넘으면 낭비한 것으로 본다.
 * 수익률로 재지 않는 이유는 그것이 시장이 움직인 결과와 구분되지 않아서다.
 */
const EFFICIENT_BPS = 50
const WASTEFUL_BPS = 150

const BASE_SCORE = 50

/** 신뢰 점수를 사용자 상한 대비 재량 비율로 옮긴다. 0점이면 10%, 100점이면 100%. */
const MIN_DISCRETION_BPS = 1_000
const DISCRETION_PER_POINT = 90

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 기록 순서를 고정한다. 합계는 순서와 무관하지만 기여 목록은 순서가 보이므로 정렬한다. */
function ordered(records: readonly TrackRecord[]): TrackRecord[] {
  return [...records].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1
    const ak = 'decisionId' in a ? a.decisionId : ''
    const bk = 'decisionId' in b ? b.decisionId : ''
    if (ak !== bk) return ak < bk ? -1 : 1
    return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0
  })
}

/**
 * 온체인 기록만으로 신뢰를 계산한다 (R10.1).
 *
 * 순수 함수이고 입력이 트랙레코드뿐이므로, 누구나 체인에서 이벤트를 긁어
 * 같은 값을 재현할 수 있다. 우리가 계산한 점수를 믿을 필요가 없다 (ADR-0003).
 *
 * 접속 횟수·결제 이력은 TrackRecord 타입에 존재하지 않아 입력 경로 자체가 없다 (R10.3).
 */
export function computeTrust(
  records: readonly TrackRecord[],
  characterId: CharacterId,
  formulaVersion: number,
): TrustResult {
  if (formulaVersion !== 1) throw new RangeError(`unsupported trust formula version: ${formulaVersion}`)
  const sorted = ordered(
    records.filter(
      (record) =>
        record.characterId === characterId &&
        (record.kind === 'disappointed' || record.kind === 'baseline' || record.trustFormulaVersion === formulaVersion),
    ),
  )

  // 판단별 운영비를 먼저 모은다. 성과는 비용을 뺀 뒤에 평가한다 (R10.2, R7.7).
  const costByDecision = new Map<string, bigint>()
  for (const r of sorted) {
    if (r.kind === 'cost') {
      const key = `${r.delegationId}:${r.decisionId}`
      costByDecision.set(key, (costByDecision.get(key) ?? 0n) + r.amount)
    }
  }

  const contributions: Contribution[] = []
  let total = 0

  for (const r of sorted) {
    switch (r.kind) {
      case 'executed': {
        if (r.valueInQuote === 0n) break
        const cost = costByDecision.get(`${r.delegationId}:${r.decisionId}`) ?? 0n
        const friction = r.frictionQuote + cost
        const ratioBps = Number((friction * 10_000n) / r.valueInQuote)

        const delta =
          ratioBps <= EFFICIENT_BPS
            ? WEIGHTS.efficient
            : ratioBps > WASTEFUL_BPS
              ? WEIGHTS.wasteful
              : 0

        if (delta !== 0) {
          total += delta
          contributions.push({
            delegationId: r.delegationId,
            decisionId: r.decisionId,
            blockNumber: r.blockNumber,
            delta: int(delta),
            reason:
              delta > 0
                ? `Efficient execution (${ratioBps}bp friction)`
                : `Wasteful execution (${ratioBps}bp friction)`,
          })
        }
        break
      }
      case 'not_executed': {
        const delta =
          r.reason === 'rejected'
            ? WEIGHTS.rejected
            : r.reason === 'budget_exhausted'
              ? WEIGHTS.budgetExhausted
              : 0
        if (delta !== 0) {
          total += delta
          contributions.push({
            delegationId: r.delegationId,
            decisionId: r.decisionId,
            blockNumber: r.blockNumber,
            delta: int(delta),
            reason: r.reason === 'rejected' ? 'Proposal rejected by owner' : 'Budget exhausted',
          })
        }
        break
      }
      case 'disappointed': {
        total += WEIGHTS.disappointed
        contributions.push({
          delegationId: r.delegationId,
          blockNumber: r.blockNumber,
          delta: int(WEIGHTS.disappointed),
          reason: 'Owner signaled disappointment',
        })
        break
      }
      // 'decided'와 'cost'는 그 자체로 점수를 바꾸지 않는다.
      // 비용은 위에서 순성과 계산에 이미 반영된다.
      case 'decided':
      case 'cost':
      case 'baseline':
        break
    }
  }

  const finalScore = clamp(BASE_SCORE + total, 0, 100)

  return {
    score: score(finalScore),
    discretionBps: bps(MIN_DISCRETION_BPS + finalScore * DISCRETION_PER_POINT),
    contributions,
    formulaVersion: TRUST_FORMULA_VERSION,
  }
}
