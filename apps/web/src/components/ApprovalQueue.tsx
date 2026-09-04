import type { PendingView } from '@soon/shared'
import { formatBps, formatQuote } from '../format.js'

/**
 * Approval request (R5.3, R5.4, R5.5, R5.8).
 *
 * Show why approval is required: an owner cap and a trust-limited discretion cap
 * communicate different constraints.
 */
export function ApprovalQueue({
  items,
  currentTimestamp,
  onApprove,
  onReject,
  onExpire,
  onFinalizeFailure,
  failedDecisionId,
  canAct,
  busy,
}: {
  items: readonly PendingView[]
  currentTimestamp: bigint
  onApprove: (pending: PendingView) => void
  onReject: (pending: PendingView) => void
  onExpire: (pending: PendingView) => void
  onFinalizeFailure: (pending: PendingView) => void
  failedDecisionId: string | undefined
  canAct: boolean
  busy: boolean
}) {
  if (items.length === 0) return null

  return (
    <div className="card">
      <h2>Review required</h2>

      {items.map((p) => {
        const left = BigInt(p.expiresAt) - currentTimestamp
        const effectiveCap = BigInt(p.effectiveCap)
        const over = BigInt(p.overBy)
        const totalValue = effectiveCap + over
        const failed = failedDecisionId?.toLowerCase() === p.decisionId.toLowerCase()
        return (
          <div key={p.decisionId} className="review" style={{ marginBottom: 12 }}>
            <p className="hint">
              {p.capSource === 'trust'
                ? 'Trust has not earned enough discretion yet.'
                : 'This order exceeds your automatic execution limit.'}
            </p>
            <div className="row">
              <span className="k">Amount to move</span>
              <span>{formatQuote(totalValue)}</span>
            </div>
            {over > 0n && (
              <div className="row">
                <span className="k">Amount over limit</span>
                <span>{formatQuote(over)}</span>
              </div>
            )}
            <div className="row">
              <span className="k">Allocation drift</span>
              <span>
                {formatBps(p.evidence.driftBps)} (allowed {formatBps(p.evidence.bandBps)})
              </span>
            </div>
            <div className="row">
              <span className="k">Trade</span>
              <span>{p.trade.tokenIn.slice(0, 6)}… → {p.trade.tokenOut.slice(0, 6)}…</span>
            </div>
            <div className="row">
              <span className="k">Minimum received</span>
              <span>{String(p.trade.minAmountOut)} base units</span>
            </div>
            <div className="row">
              <span className="k">Time remaining</span>
              <span>{left > 0n ? `${left} seconds` : 'Expired'}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="primary" disabled={!canAct || busy || left <= 0n} onClick={() => onApprove(p)}>
                Approve
              </button>
              <button disabled={!canAct || busy || left <= 0n} onClick={() => onReject(p)}>
                Reject
              </button>
              {left <= 0n && <button disabled={!canAct || busy} onClick={() => onExpire(p)}>Record expiry</button>}
              {failed && (
                <button disabled={!canAct || busy} onClick={() => onFinalizeFailure(p)}>
                  Finalize failure
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
