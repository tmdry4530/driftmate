import { useMemo, useState } from 'react'
import type { Address, Bytes32 } from '@soon/shared'
import { formatBps, formatQuote } from '../format.js'
import { type DelegationDraft, validateDraft } from '../delegationDraft.js'

export type { DelegationDraft }

/**
 * 목표 비중과 위임 범위 설정 (R3.1, R3.2, R3.3).
 *
 * 서명 전에 무엇을 허락하는지 전문을 보여준다. 사용자가 읽지 않고 서명하더라도,
 * 보여주지 않는 것과 보여준 것은 다르다.
 */
export function DelegationForm({
  tokenSymbol,
  quoteSymbol,
  tokenAddress,
  quoteAddress,
  characterName,
  strategyHash,
  trustFormulaVersion,
  executor,
  dex,
  onSubmit,
  disabled,
}: {
  tokenSymbol: string
  quoteSymbol: string
  tokenAddress: Address
  quoteAddress: Address
  characterName: string
  strategyHash: Bytes32
  trustFormulaVersion: number
  executor: Address
  dex: Address
  onSubmit: (d: DelegationDraft) => void
  disabled: boolean
}) {
  const [weight, setWeight] = useState('60')
  const [maxTrade, setMaxTrade] = useState('1000')
  const [auto, setAuto] = useState('300')
  const [budget, setBudget] = useState('5000')
  const [opCap, setOpCap] = useState('50')
  const [days, setDays] = useState('30')
  const [approvalTtlMinutes, setApprovalTtlMinutes] = useState('60')
  const [slippagePercent, setSlippagePercent] = useState('1')

  const result = useMemo(
    () =>
      validateDraft({
        weightPercent: weight,
        maxTrade,
        autoThreshold: auto,
        budget,
        operatingCap: opCap,
        days,
        approvalTtlMinutes,
        slippagePercent,
      }),
    [weight, maxTrade, auto, budget, opCap, days, approvalTtlMinutes, slippagePercent],
  )

  const errors = result.ok ? [] : result.errors
  const draft = result.ok ? result.draft : undefined

  return (
    <div className="card">
      <h2>어디까지 맡길까요</h2>
      <p className="hint">여기 적은 범위 밖의 일은 컨트랙트가 아예 거부해요.</p>

      <div className="field">
        <label htmlFor="w">
          목표 비중 — {tokenSymbol} {weight}% / {quoteSymbol} {100 - Number(weight || '0')}%
        </label>
        <input id="w" value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="numeric" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="mt">1회 최대 거래액 ($)</label>
          <input id="mt" value={maxTrade} onChange={(e) => setMaxTrade(e.target.value)} inputMode="decimal" />
        </div>
        <div className="field">
          <label htmlFor="at">자동 실행 임계값 ($)</label>
          <input id="at" value={auto} onChange={(e) => setAuto(e.target.value)} inputMode="decimal" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="bg">전체 예산 ($)</label>
          <input id="bg" value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" />
        </div>
        <div className="field">
          <label htmlFor="oc">그중 운영비 한도 ($)</label>
          <input id="oc" value={opCap} onChange={(e) => setOpCap(e.target.value)} inputMode="decimal" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="dd">유효 기간 (일)</label>
        <input id="dd" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="ttl">승인 요청 유효 시간 (분)</label>
          <input id="ttl" value={approvalTtlMinutes} onChange={(e) => setApprovalTtlMinutes(e.target.value)} inputMode="numeric" />
        </div>
        <div className="field">
          <label htmlFor="slippage">슬리피지 허용치 (%)</label>
          <input id="slippage" value={slippagePercent} onChange={(e) => setSlippagePercent(e.target.value)} inputMode="decimal" />
        </div>
      </div>

      {errors.map((e) => (
        <div key={e} className="err">{e}</div>
      ))}

      {/* 서명 전 전문 (R3.3) */}
      {draft && (
        <div className="review">
          <div className="row"><span className="k">캐릭터</span><span>{characterName}</span></div>
          <div className="row"><span className="k">전략 계약</span><span title={strategyHash}>{strategyHash.slice(0, 10)}… · v{trustFormulaVersion}</span></div>
          <div className="row"><span className="k">목표 비중</span><span>{tokenSymbol} {draft.tokenWeightBps / 100}% · {quoteSymbol} {draft.quoteWeightBps / 100}%</span></div>
          <div className="row"><span className="k">기준 자산</span><span title={quoteAddress}>{quoteSymbol} · {quoteAddress}</span></div>
          <div className="row"><span className="k">대상 자산</span><span title={tokenAddress}>{tokenSymbol} · {tokenAddress}</span></div>
          <div className="row"><span className="k">실행자</span><span>{executor}</span></div>
          <div className="row"><span className="k">허용 DEX</span><span>{dex}</span></div>
          <div className="row"><span className="k">한 번에 최대</span><span>{formatQuote(draft.maxTradeValue)}</span></div>
          <div className="row"><span className="k">이 금액까진 알아서</span><span>{formatQuote(draft.autoThreshold)}</span></div>
          <div className="row"><span className="k">전체 예산</span><span>{formatQuote(draft.budget)}</span></div>
          <div className="row"><span className="k">운영비 한도</span><span>{formatQuote(draft.operatingCap)} (예산 안에서)</span></div>
          <div className="row"><span className="k">기간</span><span>{draft.days}일</span></div>
          <div className="row"><span className="k">승인 요청 TTL</span><span>{String(draft.approvalTtlSeconds / 60n)}분</span></div>
          <div className="row"><span className="k">슬리피지 허용치</span><span>{formatBps(draft.slippageToleranceBps)}</span></div>
          <div className="row"><span className="k">인출 권한</span><span>나만 (에이전트는 불가)</span></div>
        </div>
      )}

      <button className="primary" disabled={!draft || disabled} onClick={() => draft && onSubmit(draft)}>
        위 내용으로 서명하기
      </button>
    </div>
  )
}
