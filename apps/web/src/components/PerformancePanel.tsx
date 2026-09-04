import type { Performance } from '../performance.js'
import { formatBps, formatQuote } from '../format.js'

/**
 * Performance display (R7.6, R7.7, R11.7).
 *
 * The headline metric is total friction including operating costs. Slippage-only
 * values stay in the detail view so the primary number cannot look better than reality.
 */
export function PerformancePanel({ p }: { p: Performance }) {
  return (
    <div className="card">
      <h2>Execution efficiency</h2>
      <p className="hint">Value lost relative to trading volume. Lower is better.</p>

      <div className="stat">
        <span className="big">{p.totalFrictionBps === null ? 'N/A' : formatBps(p.totalFrictionBps)}</span>
        <span className="label">Total friction including operating costs</span>
      </div>

      <div className="breakdown">
        <div className="row"><span className="k">Trades</span><span>{p.tradeCount}</span></div>
        <div className="row"><span className="k">Total volume</span><span>{formatQuote(p.totalVolume)}</span></div>
        <div className="row"><span className="k">Slippage and fees</span><span>{formatQuote(p.slippageCost)} ({p.slippageOnlyBps === null ? 'N/A' : formatBps(p.slippageOnlyBps)})</span></div>
        <div className="row"><span className="k">Operating costs (data and narration)</span><span>{formatQuote(p.operatingCost)} ({p.operatingImpactBps === null ? 'N/A' : formatBps(p.operatingImpactBps)})</span></div>
      </div>

      {p.operatingCost > 0n && (
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          Operating costs increased the headline metric by {p.operatingImpactBps === null ? 'N/A' : formatBps(p.operatingImpactBps)}.
        </p>
      )}
    </div>
  )
}
