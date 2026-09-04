import type { TrustResult } from '@soon/shared'
import { formatBps, formatQuote } from '../format.js'

/**
 * Trust and discretion (R10.4, R10.6, R10.7, R10.9).
 *
 * The evidence behind the score stays visible. There is no path to raise trust
 * with deposits or engagement; trust remains a performance record.
 */
export function TrustPanel({
  trust,
  autoThreshold,
  onDisappoint,
  canDisappoint,
  busy,
}: {
  trust: TrustResult
  autoThreshold: bigint | undefined
  onDisappoint: () => void
  canDisappoint: boolean
  busy: boolean
}) {
  const effective =
    autoThreshold === undefined
      ? undefined
      : (autoThreshold * BigInt(trust.discretionBps as number)) / 10_000n

  return (
    <div className="card">
      <h2>Trust and discretion</h2>
      <p className="hint">Trust changes only with performance, never deposits or engagement.</p>

      <div className="stat">
        <span className="big">{trust.score}</span>
        <span className="label">/ 100 · discretion {formatBps(trust.discretionBps)}</span>
      </div>

      {effective !== undefined && (
        <div className="breakdown">
          <div className="row">
            <span className="k">Autonomous amount</span>
            <span>{formatQuote(effective)}</span>
          </div>
          <div className="row">
            <span className="k">Owner-signed cap</span>
            <span>{formatQuote(autoThreshold!)}</span>
          </div>
        </div>
      )}

      {trust.contributions.length > 0 && (
        <div className="breakdown">
          {trust.contributions.slice(-5).reverse().map((c, i) => (
            <div className="row" key={i}>
              <span className="k">#{String(c.blockNumber)} {c.reason}</span>
              <span>{(c.delta as number) > 0 ? '+' : ''}{c.delta}</span>
            </div>
          ))}
        </div>
      )}

      {canDisappoint && (
        <button className="ghost" style={{ marginTop: 12 }} disabled={busy} onClick={onDisappoint}>
          I am disappointed with this outcome
        </button>
      )}
      {canDisappoint && (
        <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
          This immediately narrows discretion. Only future performance can widen it again.
        </p>
      )}
    </div>
  )
}
