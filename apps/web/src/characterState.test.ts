import { describe, expect, it } from 'vitest'
import { bps } from '@soon/engine'
import { buildLossReport, currentKeeperStatus, deriveAgentState, expressionFor } from './characterState.js'

const configHash = ('0x' + '11'.repeat(32)) as `0x${string}`
const decisionId = ('0x' + '22'.repeat(32)) as `0x${string}`
const current = {
  delegationId: 7n,
  configHash,
  stateNonce: 4n,
  pending: {
    delegationId: 7n,
    proposalNonce: 3n,
    decisionId,
    orderHash: configHash,
    evidenceHash: configHash,
    expiresAt: 100n,
    open: true,
  },
  records: [{
    kind: 'not_executed' as const,
    delegationId: 7n,
    decisionId,
    characterId: 'timid',
    trustFormulaVersion: 1,
    blockNumber: 9n,
    reason: 'rejected' as const,
  }],
}

describe('expressionFor — 손실 구간의 톤 (R9.2, R9.3)', () => {
  it('손실 중에는 밝은 표정이 나오지 않는다', () => {
    const small = expressionFor({ kind: 'loss', pnlBps: bps(-100), userDisappointed: false })
    const big = expressionFor({ kind: 'loss', pnlBps: bps(-900), userDisappointed: false })

    expect(['concerned', 'quiet']).toContain(small)
    expect(['concerned', 'quiet']).toContain(big)
    expect(small).not.toBe('cheerful')
    expect(big).not.toBe('pleased')
  })

  it('실망을 표시하면 사과하는 표정으로 바뀐다 (R9.7)', () => {
    const e = expressionFor({ kind: 'loss', pnlBps: bps(-100), userDisappointed: true })
    expect(e).toBe('apologetic')
  })

  it('상태마다 표정이 갈린다 (R9.2)', () => {
    expect(expressionFor({ kind: 'idle' })).toBe('idle')
    expect(expressionFor({ kind: 'deciding' })).toBe('thinking')
    expect(expressionFor({ kind: 'awaiting_approval' })).toBe('asking')
    expect(expressionFor({ kind: 'executed', pnlBps: bps(300) })).toBe('pleased')
  })

  it('이익이 없는 실행에는 들뜨지 않는다', () => {
    expect(expressionFor({ kind: 'executed', pnlBps: bps(0) })).toBe('idle')
  })
})

describe('buildLossReport — 수치가 먼저 (R9.4)', () => {
  it('손실 수치를 먼저 제시하고 반응을 뒤에 붙인다', () => {
    const r = buildLossReport(bps(-250), '겁 많은 아이')
    expect(r.headline).toBe('2.50% 줄었어요.')
    expect(r.reaction).toContain('겁 많은 아이')
  })

  it('머리말에 회피 표현이 없다', () => {
    const r = buildLossReport(bps(-250), '느긋한 아이')
    for (const w of ['하지만', '그래도', '괜찮', '어쩔 수 없']) {
      expect(r.headline).not.toContain(w)
    }
  })
})

describe('currentKeeperStatus와 deriveAgentState', () => {
  const status = {
    phase: 'awaiting_approval' as const,
    delegationId: '7',
    configHash,
    pending: {
      delegationId: '7',
      configHash,
      stateNonce: '4',
      decisionId,
      dex: ('0x' + '33'.repeat(20)) as `0x${string}`,
      trade: {
        tokenIn: ('0x' + '44'.repeat(20)) as `0x${string}`,
        tokenOut: ('0x' + '55'.repeat(20)) as `0x${string}`,
        amountIn: 10n,
        minAmountOut: 9n,
      },
      evidence: { weights: [], driftBps: bps(500), bandBps: bps(300), outcome: 'asked' as const },
      expiresAt: '100',
      effectiveCap: '5',
      overBy: '5',
      capSource: 'trust' as const,
    },
    lastDecision: {
      delegationId: '7',
      configHash,
      decisionId,
      outcome: 'executed' as const,
    },
    lossReport: {
      delegationId: '7',
      configHash,
      reportId: configHash,
      baselineBlock: '1',
      currentBlock: '9',
      baselineValueQuote: '100',
      currentValueQuote: '90',
      operatingSpent: '1',
      pnlQuote: '-11',
      pnlBps: bps(-1100),
      priceSource: ('0x' + '33'.repeat(20)) as `0x${string}`,
      status: 'loss' as const,
    },
  }

  it('deciding → pending → loss → executed → idle 순서를 지킨다', () => {
    expect(deriveAgentState({ ...status, phase: 'deciding' }, false).kind).toBe('deciding')
    expect(deriveAgentState(status, false).kind).toBe('awaiting_approval')
    const { pending: _pending, ...withoutPending } = status
    const { lossReport: _lossReport, ...withoutLoss } = withoutPending
    expect(deriveAgentState({ ...withoutPending, phase: 'idle' }, false).kind).toBe('loss')
    expect(deriveAgentState({ ...withoutLoss, phase: 'idle' }, false).kind).toBe('executed')
    expect(deriveAgentState(undefined, false).kind).toBe('idle')
  })

  it('온체인 세션 또는 pending 식별자가 다르면 버린다', () => {
    expect(currentKeeperStatus({ ...status, delegationId: '8' }, current)).toBeUndefined()
    const filtered = currentKeeperStatus({
      ...status,
      pending: { ...status.pending, stateNonce: '5' },
    }, current)
    expect(filtered?.pending).toBeUndefined()
    expect(filtered?.phase).toBe('idle')
  })
})
