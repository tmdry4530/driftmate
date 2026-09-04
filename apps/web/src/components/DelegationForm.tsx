import { useMemo, useState } from 'react'
import type { Address, Bytes32 } from '@soon/shared'
import { formatBps, formatQuote } from '../format.js'
import { type DelegationDraft, validateDraft } from '../delegationDraft.js'

export type { DelegationDraft }

/**
 * Target allocation and delegation limits (R3.1, R3.2, R3.3).
 *
 * Show the complete permission set before signing.
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
      <h2>Set delegation limits</h2>
      <p className="hint">The contract rejects any action outside these signed limits.</p>

      <div className="field">
        <label htmlFor="w">
          Target allocation — {tokenSymbol} {weight}% / {quoteSymbol} {100 - Number(weight || '0')}%
        </label>
        <input id="w" value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="numeric" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="mt">Maximum trade ($)</label>
          <input id="mt" value={maxTrade} onChange={(e) => setMaxTrade(e.target.value)} inputMode="decimal" />
        </div>
        <div className="field">
          <label htmlFor="at">Automatic execution limit ($)</label>
          <input id="at" value={auto} onChange={(e) => setAuto(e.target.value)} inputMode="decimal" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="bg">Total budget ($)</label>
          <input id="bg" value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" />
        </div>
        <div className="field">
          <label htmlFor="oc">Operating-cost cap ($)</label>
          <input id="oc" value={opCap} onChange={(e) => setOpCap(e.target.value)} inputMode="decimal" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="dd">Duration (days)</label>
        <input id="dd" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="ttl">Approval request TTL (minutes)</label>
          <input id="ttl" value={approvalTtlMinutes} onChange={(e) => setApprovalTtlMinutes(e.target.value)} inputMode="numeric" />
        </div>
        <div className="field">
          <label htmlFor="slippage">Slippage tolerance (%)</label>
          <input id="slippage" value={slippagePercent} onChange={(e) => setSlippagePercent(e.target.value)} inputMode="decimal" />
        </div>
      </div>

      {errors.map((e) => (
        <div key={e} className="err">{e}</div>
      ))}

      {/* Complete pre-signature review (R3.3). */}
      {draft && (
        <div className="review">
          <div className="row"><span className="k">Agent</span><span>{characterName}</span></div>
          <div className="row"><span className="k">Strategy contract</span><span title={strategyHash}>{strategyHash.slice(0, 10)}… · v{trustFormulaVersion}</span></div>
          <div className="row"><span className="k">Target allocation</span><span>{tokenSymbol} {draft.tokenWeightBps / 100}% · {quoteSymbol} {draft.quoteWeightBps / 100}%</span></div>
          <div className="row"><span className="k">Quote asset</span><span title={quoteAddress}>{quoteSymbol} · {quoteAddress}</span></div>
          <div className="row"><span className="k">Target asset</span><span title={tokenAddress}>{tokenSymbol} · {tokenAddress}</span></div>
          <div className="row"><span className="k">Executor</span><span>{executor}</span></div>
          <div className="row"><span className="k">Allowed DEX</span><span>{dex}</span></div>
          <div className="row"><span className="k">Maximum per trade</span><span>{formatQuote(draft.maxTradeValue)}</span></div>
          <div className="row"><span className="k">Automatic up to</span><span>{formatQuote(draft.autoThreshold)}</span></div>
          <div className="row"><span className="k">Total budget</span><span>{formatQuote(draft.budget)}</span></div>
          <div className="row"><span className="k">Operating-cost cap</span><span>{formatQuote(draft.operatingCap)} (within total budget)</span></div>
          <div className="row"><span className="k">Duration</span><span>{draft.days} days</span></div>
          <div className="row"><span className="k">Approval request TTL</span><span>{String(draft.approvalTtlSeconds / 60n)} minutes</span></div>
          <div className="row"><span className="k">Slippage tolerance</span><span>{formatBps(draft.slippageToleranceBps)}</span></div>
          <div className="row"><span className="k">Withdrawal permission</span><span>Owner only (never the agent)</span></div>
        </div>
      )}

      <button className="primary" disabled={!draft || disabled} onClick={() => draft && onSubmit(draft)}>
        Sign delegation
      </button>
    </div>
  )
}
