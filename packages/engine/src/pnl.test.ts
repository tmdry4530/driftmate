import { describe, expect, it } from 'vitest'
import type { Address, DecisionId, PortfolioBaseline, TrackRecord } from '@soon/shared'
import { computePnl, type PnlInput } from './pnl.js'

const VAULT = '0x0000000000000000000000000000000000000001' as Address
const TOKEN = '0x0000000000000000000000000000000000000002' as Address
const QUOTE = '0x0000000000000000000000000000000000000003' as Address
const DEX = '0x0000000000000000000000000000000000000004' as Address

const baseline: PortfolioBaseline = {
  delegationId: 1n,
  characterId: 'timid',
  quoteAsset: QUOTE,
  pricingDex: DEX,
  targetAsset: TOKEN,
  targetBalance: 10n,
  quoteBalance: 100n,
  targetPriceE18: 2n * 10n ** 18n,
  valueQuote: 120n,
  blockNumber: 1n,
}

const trade: TrackRecord = {
  kind: 'executed',
  delegationId: 1n,
  decisionId: `0x${'01'.repeat(32)}` as DecisionId,
  characterId: 'timid',
  trustFormulaVersion: 1,
  blockNumber: 2n,
  tokenIn: TOKEN,
  tokenOut: QUOTE,
  amountIn: 2n,
  amountOut: 3n,
  valueInQuote: 4n,
  valueOutQuote: 3n,
  frictionQuote: 1n,
}

const input: PnlInput = {
  vault: VAULT,
  baseline,
  current: { blockNumber: 3n, targetBalance: 8n, quoteBalance: 103n, targetPriceE18: 2n * 10n ** 18n },
  operatingSpent: 7n,
  records: [trade],
}

describe('computePnl', () => {
  it('기준점과 실행 기록으로 세션 손익과 reportId를 재현한다', () => {
    const first = computePnl(input)
    const second = computePnl(input)

    expect(first).toEqual(second)
    expect(first).toMatchObject({ status: 'loss', currentValueQuote: 119n, pnlQuote: -8n, pnlBps: -666 })
  })

  it('직접 전송처럼 기대 잔고와 다르면 손익을 중단한다', () => {
    const result = computePnl({
      ...input,
      current: { ...input.current, targetBalance: input.current.targetBalance + 1n },
    })

    expect(result).toMatchObject({ status: 'cashflow_unknown', pnlQuote: null, pnlBps: null })
  })

  it('다른 위임의 실행은 현재 세션 잔고에 섞지 않는다', () => {
    const other = { ...trade, delegationId: 2n }
    const result = computePnl({ ...input, records: [other], current: { ...input.current, targetBalance: 10n, quoteBalance: 100n } })

    expect(result.status).toBe('loss')
    expect(result.expectedTargetBalance).toBe(10n)
  })
})
