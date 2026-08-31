import type { TrustResult } from '@soon/shared'
import { formatBps, formatQuote } from '../format.js'

/**
 * 신뢰와 재량 (R10.4, R10.6, R10.7, R10.9).
 *
 * 점수를 만든 기록을 함께 보여준다. 그리고 신뢰를 돈이나 접속으로 올리는
 * 버튼은 이 화면 어디에도 없다 — 그런 경로가 있으면 신뢰가 성적표가 아니라
 * 관계의 온도가 되고, 시스템이 사용자를 오도하기 시작한다.
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
      <h2>지금 얼마나 맡겨져 있나</h2>
      <p className="hint">실적으로만 오르내려요. 돈으로도, 자주 들어온다고도 오르지 않아요.</p>

      <div className="stat">
        <span className="big">{trust.score}</span>
        <span className="label">/ 100 · 재량 {formatBps(trust.discretionBps)}</span>
      </div>

      {effective !== undefined && (
        <div className="breakdown">
          <div className="row">
            <span className="k">알아서 할 수 있는 금액</span>
            <span>{formatQuote(effective)}</span>
          </div>
          <div className="row">
            <span className="k">내가 정한 상한</span>
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
          이번 결과에 실망했어요
        </button>
      )}
      {canDisappoint && (
        <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
          누르면 재량이 즉시 좁아지고, 다시 넓어지려면 실적을 쌓아야 해요.
        </p>
      )}
    </div>
  )
}
