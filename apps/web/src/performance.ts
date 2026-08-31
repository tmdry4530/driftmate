import type { Bps, TrackRecord } from '@soon/shared'
import { bps } from '@soon/engine'

/**
 * 화면에 보여줄 성과 (R7.6, R7.7, R11.7).
 *
 * 대표값은 `totalFrictionBps` — 슬리피지와 운영비를 **둘 다** 포함한다.
 * `slippageOnlyBps`는 내역을 쪼개 보여줄 때만 쓰는 참고값이고,
 * 이것만 단독으로 크게 띄우는 화면은 만들지 않는다. 그러면 늘 실제보다
 * 좋아 보이는 숫자가 대표가 되고, 비용은 어딘가 작은 글씨로 밀린다.
 */
export type Performance = Readonly<{
  tradeCount: number
  totalVolume: bigint
  slippageCost: bigint
  operatingCost: bigint
  /** 대표값. 거래 규모 대비 총 마찰. 낮을수록 잘한 것이다. */
  totalFrictionBps: Bps
  /** 내역용. 운영비를 뺀 값이라 단독으로 쓰면 실제보다 좋아 보인다. */
  slippageOnlyBps: Bps
  /** 운영비가 대표값을 얼마나 끌어올렸는지 (R11.7). */
  operatingImpactBps: Bps
}>

export function computePerformance(records: readonly TrackRecord[]): Performance {
  const costByDecision = new Map<string, bigint>()
  for (const r of records) {
    if (r.kind === 'cost') {
      costByDecision.set(r.decisionId, (costByDecision.get(r.decisionId) ?? 0n) + r.amount)
    }
  }

  let volume = 0n
  let slippage = 0n
  let operating = 0n
  let count = 0

  for (const r of records) {
    if (r.kind !== 'executed') continue
    count += 1
    volume += r.valueQuote
    slippage += r.frictionQuote
    operating += costByDecision.get(r.decisionId) ?? 0n
  }

  // 실행에 붙지 않은 운영비(판단만 하고 거래하지 않은 경우)도 비용이다.
  for (const [decisionId, amount] of costByDecision) {
    const attached = records.some((r) => r.kind === 'executed' && r.decisionId === decisionId)
    if (!attached) operating += amount
  }

  const ratio = (part: bigint): Bps =>
    volume === 0n ? bps(0) : bps(Number((part * 10_000n) / volume))

  return {
    tradeCount: count,
    totalVolume: volume,
    slippageCost: slippage,
    operatingCost: operating,
    totalFrictionBps: ratio(slippage + operating),
    slippageOnlyBps: ratio(slippage),
    operatingImpactBps: ratio(operating),
  }
}
