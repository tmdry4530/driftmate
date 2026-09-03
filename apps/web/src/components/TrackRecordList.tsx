import type { TrackRecord } from '@soon/shared'
import { formatBps, formatQuote } from '../format.js'

const REASON_LABEL: Record<string, string> = {
  rejected: '내가 거절함',
  expired: '답을 못 해서 만료',
  cost_exceeds_benefit: '비용이 이득보다 커서',
  slippage: '체결가가 나빠서',
  stale_price: '가격이 오래돼서',
  budget_exhausted: '예산이 모자라서',
  within_band: '허용 범위 안이라서',
  below_min_trade: '최소 거래액보다 작아서',
  execution_failed: '실행 트랜잭션이 실패해서',
}

/**
 * 트랙레코드 (R7.2, R7.4, R7.5).
 *
 * 실행되지 않은 판단도 같은 목록에 남긴다. 성공한 거래만 보이면 기록이
 * 저절로 좋아 보이고, 그 순간 "검증 가능한 트랙레코드"라는 말이 무의미해진다.
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
      <h2>무엇을 했는지</h2>
      <p className="hint">한 일과 하지 않은 일이 함께 남아요. 모두 체인에서 확인할 수 있어요.</p>

      {rows.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>아직 기록이 없어요.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>블록</th>
                <th>무슨 일</th>
                <th>내용</th>
                <th className="num">금액</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.blockNumber}-${i}`}>
                  <td>
                    {/* 어느 트랜잭션에서 나온 기록인지 항상 보여준다 (R7.5).
                        익스플로러가 있으면 링크로, 없으면 해시 앞자리로. */}
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
                    {r.kind === 'executed' && <span className="chip done">실행</span>}
                    {r.kind === 'not_executed' && <span className="chip skip">안 함</span>}
                    {r.kind === 'cost' && <span className="chip cost">비용</span>}
                    {r.kind === 'decided' && <span className="chip skip">판단</span>}
                    {r.kind === 'disappointed' && <span className="chip skip">실망 표시</span>}
                  </td>
                  <td>
                    {r.kind === 'executed' && `${formatBps(Number((r.frictionQuote * 10_000n) / (r.valueInQuote || 1n)))} 마찰`}
                    {r.kind === 'not_executed' && (REASON_LABEL[r.reason] ?? r.reason)}
                    {r.kind === 'cost' && (r.costKind === 'price_data' ? '가격 데이터' : '설명 생성')}
                    {r.kind === 'decided' && '판단 기록'}
                    {r.kind === 'disappointed' && '재량이 좁아짐'}
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
