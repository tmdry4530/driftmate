import type { Bps, CharacterId, TrackRecord } from '@soon/shared'
import { bps } from '@soon/engine'

/**
 * Performance shown in the UI (R7.6, R7.7, R11.7).
 *
 * The headline value is `totalFrictionBps`, including both slippage and operating costs.
 * `slippageOnlyBps` is a supporting breakdown and must not become the headline metric.
 */
export type Performance = Readonly<{
  tradeCount: number
  totalVolume: bigint
  slippageCost: bigint
  operatingCost: bigint
  /** Headline metric: total friction relative to volume. Lower is better. */
  totalFrictionBps: Bps | null
  /** Supporting breakdown excluding operating costs. */
  slippageOnlyBps: Bps | null
  /** Operating-cost contribution to the headline metric (R11.7). */
  operatingImpactBps: Bps | null
}>

export function computePerformance(records: readonly TrackRecord[], characterId: CharacterId): Performance {
  const selected = records.filter((record) => record.characterId === characterId)
  const costByDecision = new Map<string, bigint>()
  for (const r of selected) {
    if (r.kind === 'cost') {
      const key = `${r.delegationId}:${r.decisionId}`
      costByDecision.set(key, (costByDecision.get(key) ?? 0n) + r.amount)
    }
  }

  let volume = 0n
  let slippage = 0n
  let operating = 0n
  let count = 0

  for (const r of selected) {
    if (r.kind !== 'executed') continue
    count += 1
    volume += r.valueInQuote
    slippage += r.frictionQuote
    operating += costByDecision.get(`${r.delegationId}:${r.decisionId}`) ?? 0n
  }

  // Operating costs without an execution are still costs.
  for (const [key, amount] of costByDecision) {
    const attached = selected.some(
      (r) => r.kind === 'executed' && `${r.delegationId}:${r.decisionId}` === key,
    )
    if (!attached) operating += amount
  }

  const ratio = (part: bigint): Bps | null =>
    volume === 0n ? null : bps(Number((part * 10_000n) / volume))

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
