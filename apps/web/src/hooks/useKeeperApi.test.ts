import { describe, expect, it } from 'vitest'
import { parseKeeperStatus } from './useKeeperApi.js'

const hash = '0x' + '11'.repeat(32)
const address = '0x' + '22'.repeat(20)

describe('parseKeeperStatus', () => {
  it('owner 승인 주문의 정수를 bigint로 복원한다', () => {
    const status = parseKeeperStatus({
      phase: 'awaiting_approval',
      delegationId: '3',
      configHash: hash,
      pending: {
        delegationId: '3', configHash: hash, stateNonce: '5', decisionId: hash, dex: address,
        trade: { tokenIn: address, tokenOut: address, amountIn: '42', minAmountOut: '40' },
        evidence: { weights: [], driftBps: 500, bandBps: 300, outcome: 'asked' },
        expiresAt: '100', effectiveCap: '20', overBy: '22', capSource: 'trust',
      },
    })
    expect(status.pending?.trade.amountIn).toBe(42n)
    expect(status.pending?.trade.minAmountOut).toBe(40n)
  })

  it('유효하지 않은 주문 숫자와 주소를 거부한다', () => {
    const raw = {
      phase: 'awaiting_approval', delegationId: '3', configHash: hash,
      pending: {
        delegationId: '3', configHash: hash, stateNonce: '5', decisionId: hash, dex: address,
        trade: { tokenIn: address, tokenOut: '0x1234', amountIn: '-1', minAmountOut: '40' },
        evidence: { weights: [], driftBps: 500, bandBps: 300, outcome: 'asked' },
        expiresAt: '100', effectiveCap: '20', overBy: '22', capSource: 'trust',
      },
    }
    expect(() => parseKeeperStatus(raw)).toThrow()
  })

  it('표시용 손익도 렌더 전에 검증한다', () => {
    expect(() => parseKeeperStatus({
      phase: 'idle', delegationId: '3', configHash: hash,
      lossReport: {
        delegationId: '3', configHash: hash, reportId: hash,
        baselineBlock: '1', currentBlock: '2', baselineValueQuote: '100',
        currentValueQuote: '90', operatingSpent: '1', pnlQuote: '<script>',
        pnlBps: -1100, priceSource: address, status: 'loss',
      },
    })).toThrow()
  })
})
