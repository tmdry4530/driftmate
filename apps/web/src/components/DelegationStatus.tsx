import { formatQuote } from '../format.js'

/**
 * 현재 위임 상태와 철회 (R3.5, R11.2).
 *
 * 철회 버튼을 눈에 띄는 곳에 둔다 — 맡긴 것을 되돌리는 길이 찾기 어려우면
 * 비수탁이라는 말이 형식만 남는다.
 */
export function DelegationStatus({
  budget,
  budgetSpent,
  operatingCap,
  onRevoke,
  canRevoke,
  busy,
}: {
  budget: bigint | undefined
  budgetSpent: bigint | undefined
  operatingCap: bigint | undefined
  onRevoke: () => void
  canRevoke: boolean
  busy: boolean
}) {
  if (budget === undefined || budgetSpent === undefined) return null

  const remaining = budget > budgetSpent ? budget - budgetSpent : 0n
  const nearlyOut = budget > 0n && remaining * 10n < budget // 10% 미만
  const exhausted = remaining === 0n

  return (
    <div className="card">
      <h2>맡긴 예산</h2>
      <p className="hint">거래와 운영비가 이 하나를 함께 씁니다.</p>

      <div className="row"><span className="k">남은 예산</span><span>{formatQuote(remaining)}</span></div>
      <div className="row"><span className="k">쓴 금액</span><span>{formatQuote(budgetSpent)}</span></div>
      {operatingCap !== undefined && (
        <div className="row"><span className="k">그중 운영비 한도</span><span>{formatQuote(operatingCap)}</span></div>
      )}

      {(exhausted || nearlyOut) && (
        <div className="notice" style={{ marginTop: 12 }}>
          {exhausted
            ? '예산을 다 썼어요. 갱신하기 전까지 판단도 거래도 하지 않아요.'
            : '예산이 얼마 남지 않았어요. 곧 멈추게 돼요.'}
        </div>
      )}

      <button className="ghost" style={{ marginTop: 12 }} disabled={!canRevoke || busy} onClick={onRevoke}>
        위임 철회하기
      </button>
      <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
        철회하면 자동 실행이 즉시 멈춰요. 예치한 자산은 언제든 그대로 꺼낼 수 있어요.
      </p>
    </div>
  )
}
