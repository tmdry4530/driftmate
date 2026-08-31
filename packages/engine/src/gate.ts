import type { Decision, GateResult, SignedLimits, TrustResult } from '@soon/shared'
import { normalizeAddress } from './address.js'
import { BPS_DENOMINATOR } from './constants.js'

const BPS_D = BigInt(BPS_DENOMINATOR)

/**
 * 자동 실행할지 물어볼지 판정한다 (R5).
 *
 * 거래 내용은 이미 확정되어 들어온다 — 이 함수는 무엇을 사고팔지 바꾸지 않고
 * "알아서 할지 물어볼지"만 정한다 (R10.8).
 *
 * 유효 임계값은 사용자 상한에 신뢰 비율을 곱한 값이다. 비율이 10000bp를 넘을 수
 * 없으므로 신뢰가 최대여도 사용자 상한과 같아질 뿐이다 (R5.7).
 *
 * 여기서 통과해도 볼트가 같은 한도를 다시 검증한다. 이 검사는 UX를 위한 것이고
 * 실제 방어선은 컨트랙트다 (R6.2).
 */
export function resolveGate(
  decision: Decision,
  trust: TrustResult,
  limits: SignedLimits,
  /** 현재 체인 시각(초). 볼트가 만료를 block.timestamp로 재므로 같은 단위를 쓴다. */
  currentTimestamp: bigint,
): GateResult {
  const effectiveCap = (limits.autoThreshold * BigInt(trust.discretionBps as number)) / BPS_D
  const capSource = effectiveCap < limits.autoThreshold ? 'trust' : 'user'

  if (currentTimestamp > limits.expiry) {
    return { action: 'reject', reason: 'expired' }
  }

  // 실행할 거래가 없으면 통과시킨다. 기록은 호출자가 남긴다.
  if (decision.trades.length === 0) {
    return { action: 'auto', effectiveCap, capSource }
  }

  const allowed = new Set(limits.allowedAssets.map(normalizeAddress))
  for (const t of decision.trades) {
    if (!allowed.has(normalizeAddress(t.tokenIn)) || !allowed.has(normalizeAddress(t.tokenOut))) {
      return { action: 'reject', reason: 'asset_not_allowed' }
    }
  }

  // 거래와 운영비가 같은 예산을 쓴다 (R3.7).
  if (limits.budgetSpent + decision.totalValue > limits.budget) {
    return { action: 'reject', reason: 'budget_exhausted' }
  }

  // 하드캡은 승인 여부와 무관하게 넘을 수 없다 (R5.6).
  if (decision.totalValue > limits.maxTradeValue) {
    return { action: 'reject', reason: 'exceeds_hard_cap' }
  }

  if (decision.totalValue <= effectiveCap) {
    return { action: 'auto', effectiveCap, capSource }
  }

  return {
    action: 'ask',
    overBy: decision.totalValue - effectiveCap,
    effectiveCap,
    capSource,
  }
}
