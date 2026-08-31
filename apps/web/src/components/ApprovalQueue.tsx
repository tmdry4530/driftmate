import type { PendingApproval } from '@soon/keeper'
import { formatBps, formatQuote } from '../format.js'

/**
 * 승인 요청 (R5.3, R5.4, R5.5, R5.8).
 *
 * 왜 물어보는지를 함께 보여준다 — 내가 정한 상한에 걸린 것인지,
 * 아직 신뢰가 덜 쌓여 재량이 좁은 것인지는 사용자에게 전혀 다른 정보다.
 */
export function ApprovalQueue({
  items,
  capSource,
  effectiveCap,
  currentBlock,
  onApprove,
  onReject,
  busy,
}: {
  items: readonly PendingApproval[]
  capSource: 'user' | 'trust' | undefined
  effectiveCap: bigint | undefined
  currentBlock: bigint
  onApprove: (id: `0x${string}`) => void
  onReject: (id: `0x${string}`) => void
  busy: boolean
}) {
  if (items.length === 0) return null

  return (
    <div className="card">
      <h2>확인이 필요해요</h2>
      <p className="hint">
        {capSource === 'trust'
          ? '아직 신뢰가 덜 쌓여서 재량이 좁아요. 실적이 쌓이면 이 선이 넓어져요.'
          : '내가 정한 자동 실행 상한을 넘는 금액이에요.'}
        {effectiveCap !== undefined && ` (지금 알아서 할 수 있는 한도: ${formatQuote(effectiveCap)})`}
      </p>

      {items.map((p) => {
        const left = p.expiresAtBlock - currentBlock
        const over = effectiveCap === undefined ? 0n : p.decision.totalValue - effectiveCap
        return (
          <div key={p.decision.id} className="review" style={{ marginBottom: 12 }}>
            <div className="row">
              <span className="k">옮길 금액</span>
              <span>{formatQuote(p.decision.totalValue)}</span>
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
                {formatBps(p.decision.evidence.driftBps)} (허용 {formatBps(p.decision.evidence.bandBps)})
              </span>
            </div>
            {p.decision.trades.map((t, i) => (
              <div className="row" key={i}>
                <span className="k">거래</span>
                <span>
                  {t.tokenIn.slice(0, 6)}… → {t.tokenOut.slice(0, 6)}…
                </span>
              </div>
            ))}
            <div className="row">
              <span className="k">남은 시간</span>
              <span>{left > 0n ? `${left}블록` : '만료됨'}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="primary" disabled={busy || left <= 0n} onClick={() => onApprove(p.decision.id)}>
                진행할게요
              </button>
              <button disabled={busy} onClick={() => onReject(p.decision.id)}>
                이번엔 하지 마요
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
