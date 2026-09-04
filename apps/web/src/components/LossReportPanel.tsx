import type { LossReport } from '@soon/shared'
import { formatBps, formatQuote, shortAddress } from '../format.js'

function signedQuote(value: string): string {
  const amount = BigInt(value)
  return amount < 0n ? '-' + formatQuote(-amount) : formatQuote(amount)
}

/** Reproducible session P&L evidence shown before the character reaction. */
export function LossReportPanel({ report }: { report: LossReport | undefined }) {
  if (!report || report.status === 'cashflow_unknown') return null
  return (
    <div className="card">
      <h2>Current delegation P&amp;L</h2>
      <div className="stat">
        <span className="big">{formatBps(report.pnlBps)}</span>
        <span className="label">Session P&amp;L after operating costs</span>
      </div>
      <div className="breakdown">
        <div className="row"><span className="k">Baseline</span><span>#{report.baselineBlock} · {formatQuote(BigInt(report.baselineValueQuote))}</span></div>
        <div className="row"><span className="k">Current</span><span>#{report.currentBlock} · {formatQuote(BigInt(report.currentValueQuote))}</span></div>
        <div className="row"><span className="k">P&amp;L</span><span>{signedQuote(report.pnlQuote)}</span></div>
        <div className="row"><span className="k">Operating costs spent</span><span>{formatQuote(BigInt(report.operatingSpent))}</span></div>
        <div className="row"><span className="k">Price source</span><span title={report.priceSource}>{shortAddress(report.priceSource)}</span></div>
      </div>
    </div>
  )
}
