import { describe, expect, it } from 'vitest'
import type { Address, DecisionId, TrackRecord } from '@soon/shared'
import { computePerformance } from './performance.js'

const TOKEN = '0x1111111111111111111111111111111111111111' as Address
const USDC = '0x2222222222222222222222222222222222222222' as Address

function did(n: number): DecisionId {
  return `0x${n.toString(16).padStart(64, '0')}`
}

function trade(n: number, volume: bigint, slippage: bigint, cost: bigint): TrackRecord[] {
  return [
    { kind: 'cost', decisionId: did(n), blockNumber: BigInt(n), amount: cost, costKind: 'price_data' },
    {
      kind: 'executed',
      decisionId: did(n),
      blockNumber: BigInt(n),
      tokenIn: TOKEN,
      tokenOut: USDC,
      amountIn: 1n,
      amountOut: 1n,
      valueQuote: volume,
      frictionQuote: slippage,
    },
  ]
}

describe('computePerformance (R7.6, R7.7, R11.7)', () => {
  it('대표값에 운영비가 반드시 포함된다', () => {
    // $1000 거래에 슬리피지 $1, 운영비 $1 → 합쳐 20bp
    const p = computePerformance(trade(1, 1_000_000_000n, 1_000_000n, 1_000_000n))

    expect(p.totalFrictionBps).toBe(20)
    expect(p.slippageOnlyBps).toBe(10)
    expect(p.operatingImpactBps).toBe(10)
    // 대표값이 참고값보다 항상 나쁘거나 같다 — 비용을 숨기지 않는다.
    expect(p.totalFrictionBps).toBeGreaterThanOrEqual(p.slippageOnlyBps)
  })

  it('운영비가 커지면 대표값이 나빠진다', () => {
    const cheap = computePerformance(trade(1, 1_000_000_000n, 1_000_000n, 1_000_000n))
    const pricey = computePerformance(trade(1, 1_000_000_000n, 1_000_000n, 30_000_000n))

    // 슬리피지는 같은데 데이터를 비싸게 샀다.
    expect(pricey.slippageOnlyBps).toBe(cheap.slippageOnlyBps)
    expect(pricey.totalFrictionBps).toBeGreaterThan(cheap.totalFrictionBps)
  })

  it('거래로 이어지지 않은 판단의 운영비도 비용에 잡힌다', () => {
    const records: TrackRecord[] = [
      ...trade(1, 1_000_000_000n, 1_000_000n, 1_000_000n),
      // 판단만 하고 실행하지 않은 건 — 데이터 값은 이미 나갔다.
      { kind: 'cost', decisionId: did(9), blockNumber: 9n, amount: 5_000_000n, costKind: 'price_data' },
      { kind: 'not_executed', decisionId: did(9), blockNumber: 9n, reason: 'cost_exceeds_benefit' },
    ]
    const p = computePerformance(records)
    expect(p.operatingCost).toBe(6_000_000n)
  })

  it('여러 거래를 누적한다', () => {
    const p = computePerformance([
      ...trade(1, 1_000_000_000n, 1_000_000n, 500_000n),
      ...trade(2, 2_000_000_000n, 2_000_000n, 500_000n),
    ])
    expect(p.tradeCount).toBe(2)
    expect(p.totalVolume).toBe(3_000_000_000n)
    expect(p.slippageCost).toBe(3_000_000n)
    expect(p.operatingCost).toBe(1_000_000n)
  })

  it('거래가 없으면 0으로 둔다', () => {
    const p = computePerformance([])
    expect(p.tradeCount).toBe(0)
    expect(p.totalFrictionBps).toBe(0)
  })
})
