import type { Performance } from '../performance.js'
import { formatBps, formatQuote } from '../format.js'

/**
 * 성과 표시 (R7.6, R7.7, R11.7).
 *
 * 대표값은 운영비까지 포함한 총 마찰이다. 슬리피지만 뺀 값은 내역 안에서만
 * 보이고, 그것만 크게 띄우는 화면은 이 앱에 없다 — 그러면 늘 실제보다 좋아
 * 보이는 숫자가 대표가 된다.
 */
export function PerformancePanel({ p }: { p: Performance }) {
  return (
    <div className="card">
      <h2>지금까지 얼마나 잘 옮겼나</h2>
      <p className="hint">거래 규모 대비 새어나간 값입니다. 낮을수록 좋아요.</p>

      <div className="stat">
        <span className="big">{formatBps(p.totalFrictionBps)}</span>
        <span className="label">운영비까지 포함한 총 마찰</span>
      </div>

      <div className="breakdown">
        <div className="row"><span className="k">거래 횟수</span><span>{p.tradeCount}회</span></div>
        <div className="row"><span className="k">총 거래 규모</span><span>{formatQuote(p.totalVolume)}</span></div>
        <div className="row"><span className="k">슬리피지·수수료</span><span>{formatQuote(p.slippageCost)} ({formatBps(p.slippageOnlyBps)})</span></div>
        <div className="row"><span className="k">운영비 (데이터·설명)</span><span>{formatQuote(p.operatingCost)} ({formatBps(p.operatingImpactBps)})</span></div>
      </div>

      {p.operatingCost > 0n && (
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          운영비가 대표 수치를 {formatBps(p.operatingImpactBps)}만큼 끌어올렸어요.
        </p>
      )}
    </div>
  )
}
