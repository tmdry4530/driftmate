import type { PendingView } from '@soon/shared'
import { formatBps, formatQuote } from '../format.js'

/**
 * 승인 요청 (R5.3, R5.4, R5.5, R5.8).
 *
 * 왜 물어보는지를 함께 보여준다 — 내가 정한 상한에 걸린 것인지,
 * 아직 신뢰가 덜 쌓여 재량이 좁은 것인지는 사용자에게 전혀 다른 정보다.
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
      <h2>확인이 필요해요</h2>

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
                ? '아직 신뢰가 덜 쌓여서 재량이 좁아요.'
                : '내가 정한 자동 실행 상한을 넘는 금액이에요.'}
            </p>
            <div className="row">
              <span className="k">옮길 금액</span>
              <span>{formatQuote(totalValue)}</span>
            </div>
            {over > 0n && (
              <div className="row">
                <span className="k">한도 초과분</span>
                <span>{formatQuote(over)}</span>
              </div>
            )}
            <div className="row">
              <span className="k">이탈폭</span>
              <span>
                {formatBps(p.evidence.driftBps)} (허용 {formatBps(p.evidence.bandBps)})
              </span>
            </div>
            <div className="row">
              <span className="k">거래</span>
              <span>{p.trade.tokenIn.slice(0, 6)}… → {p.trade.tokenOut.slice(0, 6)}…</span>
            </div>
            <div className="row">
              <span className="k">최소 수령량</span>
              <span>{String(p.trade.minAmountOut)} base units</span>
            </div>
            <div className="row">
              <span className="k">남은 시간</span>
              <span>{left > 0n ? `${left}초` : '만료됨'}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="primary" disabled={!canAct || busy || left <= 0n} onClick={() => onApprove(p)}>
                진행할게요
              </button>
              <button disabled={!canAct || busy || left <= 0n} onClick={() => onReject(p)}>
                이번엔 하지 마요
              </button>
              {left <= 0n && <button disabled={!canAct || busy} onClick={() => onExpire(p)}>만료 기록하기</button>}
              {failed && (
                <button disabled={!canAct || busy} onClick={() => onFinalizeFailure(p)}>
                  실패로 종결하기
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
