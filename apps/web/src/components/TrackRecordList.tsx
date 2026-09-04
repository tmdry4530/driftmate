import type { TrackRecord } from '@soon/shared'
import { formatBps, formatQuote } from '../format.js'

const REASON_LABEL: Record<string, string> = {
  rejected: 'Rejected by owner',
  expired: 'Approval expired',
  cost_exceeds_benefit: 'Cost exceeded benefit',
  slippage: 'Execution price was too poor',
  stale_price: 'Price data was stale',
  budget_exhausted: 'Budget was exhausted',
  within_band: 'Allocation stayed within the allowed band',
  below_min_trade: 'Amount was below the minimum trade',
  execution_failed: 'Execution transaction failed',
}

/**
 * Track record (R7.2, R7.4, R7.5).
 *
 * Non-executed decisions remain beside successful trades so the record cannot
 * become selectively flattering.
 */
export function TrackRecordList({
  records,
  explorerBase,
}: {
  records: readonly TrackRecord[]
  explorerBase?: string | undefined
}) {
  const rows = [...records].sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1))

  return (
    <div className="card">
      <h2>On-chain track record</h2>
      <p className="hint">Actions and non-actions are both recorded and verifiable on-chain.</p>

      {rows.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>No records yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Block</th>
                <th>Event</th>
                <th>Details</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.blockNumber}-${i}`}>
                  <td>
                    {/* Always identify the source transaction (R7.5): link through an
                        explorer when available, otherwise show the hash prefix. */}
                    {r.txHash ? (
                      explorerBase ? (
                        <a href={`${explorerBase}/tx/${r.txHash}`} target="_blank" rel="noreferrer">
                          #{String(r.blockNumber)}
                        </a>
                      ) : (
                        <span title={r.txHash}>
                          #{String(r.blockNumber)}{' '}
                          <span className="tag">{r.txHash.slice(0, 10)}…</span>
                        </span>
                      )
                    ) : (
                      `#${String(r.blockNumber)}`
                    )}
                  </td>
                  <td>
                    {r.kind === 'executed' && <span className="chip done">Executed</span>}
                    {r.kind === 'not_executed' && <span className="chip skip">Skipped</span>}
                    {r.kind === 'cost' && <span className="chip cost">Cost</span>}
                    {r.kind === 'decided' && <span className="chip skip">Decision</span>}
                    {r.kind === 'disappointed' && <span className="chip skip">Disappointment</span>}
                  </td>
                  <td>
                    {r.kind === 'executed' && `${formatBps(Number((r.frictionQuote * 10_000n) / (r.valueInQuote || 1n)))} friction`}
                    {r.kind === 'not_executed' && (REASON_LABEL[r.reason] ?? r.reason)}
                    {r.kind === 'cost' && (r.costKind === 'price_data' ? 'Price data' : 'Narration')}
                    {r.kind === 'decided' && 'Decision recorded'}
                    {r.kind === 'disappointed' && 'Discretion narrowed'}
                  </td>
                  <td className="num">
                    {r.kind === 'executed' && formatQuote(r.valueInQuote)}
                    {r.kind === 'cost' && formatQuote(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
