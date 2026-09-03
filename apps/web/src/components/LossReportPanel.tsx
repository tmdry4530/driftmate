import type { LossReport } from '@soon/shared'
import { formatBps, formatQuote, shortAddress } from '../format.js'

function signedQuote(value: string): string {
  const amount = BigInt(value)
  return amount < 0n ? '-' + formatQuote(-amount) : formatQuote(amount)
}

/** 캐릭터 반응보다 먼저 보여주는 재현 가능한 세션 손익 근거. */
export function LossReportPanel({ report }: { report: LossReport | undefined }) {
  if (!report || report.status === 'cashflow_unknown') return null
  return (
    <div className="card">
      <h2>이번 위임의 손익 근거</h2>
      <div className="stat">
        <span className="big">{formatBps(report.pnlBps)}</span>
        <span className="label">운영비 포함 세션 손익</span>
      </div>
      <div className="breakdown">
        <div className="row"><span className="k">기준점</span><span>#{report.baselineBlock} · {formatQuote(BigInt(report.baselineValueQuote))}</span></div>
        <div className="row"><span className="k">현재</span><span>#{report.currentBlock} · {formatQuote(BigInt(report.currentValueQuote))}</span></div>
        <div className="row"><span className="k">손익 금액</span><span>{signedQuote(report.pnlQuote)}</span></div>
        <div className="row"><span className="k">누적 운영비</span><span>{formatQuote(BigInt(report.operatingSpent))}</span></div>
        <div className="row"><span className="k">가격 근거</span><span title={report.priceSource}>{shortAddress(report.priceSource)}</span></div>
      </div>
    </div>
  )
}
