import { formatQuote } from '../format.js'

/**
 * Current delegation status and revocation (R3.5, R11.2).
 *
 * Keep revocation prominent; non-custodial control must be easy to exercise.
 */
export function DelegationStatus({
  budget,
  budgetSpent,
  operatingCap,
  operatingSpent,
  expiry,
  onRevoke,
  canRevoke,
  busy,
}: {
  budget: bigint | undefined
  budgetSpent: bigint | undefined
  operatingCap: bigint | undefined
  operatingSpent: bigint | undefined
  expiry: bigint | undefined
  onRevoke: () => void
  canRevoke: boolean
  busy: boolean
}) {
  if (budget === undefined || budgetSpent === undefined) return null

  const remaining = budget > budgetSpent ? budget - budgetSpent : 0n
  const nearlyOut = budget > 0n && remaining * 10n < budget // Below 10%.
  const exhausted = remaining === 0n

  return (
    <div className="card">
      <h2>Delegated budget</h2>
      <p className="hint">Trades and operating costs share this single budget.</p>

      <div className="row"><span className="k">Remaining budget</span><span>{formatQuote(remaining)}</span></div>
      <div className="row"><span className="k">Spent</span><span>{formatQuote(budgetSpent)}</span></div>
      {operatingCap !== undefined && (
        <div className="row"><span className="k">Operating-cost cap</span><span>{formatQuote(operatingCap)}</span></div>
      )}
      {operatingSpent !== undefined && (
        <div className="row"><span className="k">Operating costs spent</span><span>{formatQuote(operatingSpent)}</span></div>
      )}
      {expiry !== undefined && (
        <div className="row"><span className="k">Delegation expires</span><span>{new Date(Number(expiry) * 1000).toLocaleString('en-US')}</span></div>
      )}

      {(exhausted || nearlyOut) && (
        <div className="notice" style={{ marginTop: 12 }}>
          {exhausted
            ? 'The budget is exhausted. Decisions and trades stop until renewal.'
            : 'The budget is almost exhausted. The agent will stop soon.'}
        </div>
      )}

      <button className="ghost" style={{ marginTop: 12 }} disabled={!canRevoke || busy} onClick={onRevoke}>
        Revoke delegation
      </button>
      <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
        Revocation stops automatic execution immediately. Deposits and withdrawals also end the current delegation, and withdrawals return assets only to the owner.
      </p>
    </div>
  )
}
