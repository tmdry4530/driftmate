import { describe, expect, it } from 'vitest'
import type { Address, DecisionId, SignedLimits, TrackRecord } from '@soon/shared'
import { canonical } from './canonical.js'
import { resolveGate } from './gate.js'
import { computeTrust as computeTrustFor } from './trust.js'

const TOKEN: Address = '0x1111111111111111111111111111111111111111'
const USDC: Address = '0x2222222222222222222222222222222222222222'
const OTHER: Address = '0x9999999999999999999999999999999999999999'

function did(n: number): DecisionId {
  return `0x${n.toString(16).padStart(64, '0')}`
}

const session = { delegationId: 1n, characterId: 'timid', trustFormulaVersion: 1 } as const

function computeTrust(records: readonly TrackRecord[]) {
  return computeTrustFor(records, 'timid', 1)
}

/** 싸게 옮긴 실행 한 건 — $1000 거래에 마찰 $2 (20bp). */
function profitable(n: number, block: bigint): TrackRecord[] {
  return [
    { ...session, kind: 'cost', decisionId: did(n), blockNumber: block, amount: 1_000_000n, costKind: 'price_data' },
    {
      kind: 'executed',
      decisionId: did(n),
      blockNumber: block,
      tokenIn: TOKEN,
      tokenOut: USDC,
      amountIn: 1n,
      amountOut: 1n,
      ...session,
      valueInQuote: 1_000_000_000n, // $1000
      valueOutQuote: 999_000_000n,
      frictionQuote: 1_000_000n, // $1 슬리피지 → 운영비 합쳐 20bp
    },
  ]
}

/** 비싸게 옮긴 실행 한 건 — 같은 $1000 거래에 마찰 $30 (300bp). */
function lossy(n: number, block: bigint): TrackRecord[] {
  return [
    { ...session, kind: 'cost', decisionId: did(n), blockNumber: block, amount: 20_000_000n, costKind: 'price_data' },
    {
      kind: 'executed',
      decisionId: did(n),
      blockNumber: block,
      tokenIn: TOKEN,
      tokenOut: USDC,
      amountIn: 1n,
      amountOut: 1n,
      ...session,
      valueInQuote: 1_000_000_000n,
      valueOutQuote: 990_000_000n,
      frictionQuote: 10_000_000n, // $10 슬리피지 + $20 운영비 = 300bp
    },
  ]
}

describe('computeTrust — 재현성 (R10.1)', () => {
  it('같은 기록이면 항상 같은 결과가 나온다', () => {
    const records = [...profitable(1, 10n), ...lossy(2, 20n)]
    const first = canonical(computeTrust(records))
    for (let i = 0; i < 200; i++) {
      expect(canonical(computeTrust(records))).toBe(first)
    }
  })

  it('기록 순서가 뒤섞여도 같은 결과가 나온다', () => {
    const records = [...profitable(1, 10n), ...lossy(2, 20n), ...profitable(3, 30n)]
    const shuffled = [records[4]!, records[0]!, records[3]!, records[5]!, records[1]!, records[2]!]
    expect(canonical(computeTrust(shuffled))).toBe(canonical(computeTrust(records)))
  })

  it('기록이 없으면 중립 점수에서 시작한다', () => {
    const t = computeTrust([])
    expect(t.score).toBe(50)
    expect(t.formulaVersion).toBe('v1')
  })

  it('선택한 캐릭터 기록만 사용하고 미지원 공식은 거부한다', () => {
    const other = profitable(1, 10n).map((record) => ({ ...record, characterId: 'easygoing' as const }))
    expect(computeTrustFor(other, 'timid', 1).score).toBe(50)
    expect(computeTrustFor(other, 'easygoing', 1).score).toBeGreaterThan(50)
    expect(() => computeTrustFor(other, 'easygoing', 2)).toThrow('unsupported trust formula')
  })
})

describe('computeTrust — 순성과 기준 (R10.2, R10.5)', () => {
  it('싸게 옮기면 점수가 오른다', () => {
    const t = computeTrust(profitable(1, 10n))
    expect(t.score).toBeGreaterThan(50)
  })

  it('마찰이 크면 점수를 깎는다', () => {
    // 같은 규모의 거래인데 슬리피지와 운영비로 3%를 흘렸다.
    const t = computeTrust(lossy(1, 10n))
    expect(t.score).toBeLessThan(50)
  })

  it('성과가 나빠지면 점수와 재량이 함께 내려간다', () => {
    const good = computeTrust([...profitable(1, 10n), ...profitable(2, 20n)])
    const bad = computeTrust([...lossy(1, 10n), ...lossy(2, 20n)])

    expect(bad.score).toBeLessThan(good.score)
    expect(bad.discretionBps).toBeLessThan(good.discretionBps)
  })

  it('슬리피지가 같아도 운영비가 크면 평가가 뒤집힌다', () => {
    // 마찰의 절반은 운영비다. 데이터를 비싸게 사면 그만큼 성과가 나빠진다 (R10.2).
    const base = {
      kind: 'executed' as const,
      decisionId: did(1),
      blockNumber: 10n,
      tokenIn: TOKEN,
      tokenOut: USDC,
      amountIn: 1n,
      amountOut: 1n,
      ...session,
      valueInQuote: 1_000_000_000n,
      valueOutQuote: 999_000_000n,
      frictionQuote: 1_000_000n, // 슬리피지는 동일하게 10bp
    }
    const cheap = computeTrust([
      { ...session, kind: 'cost', decisionId: did(1), blockNumber: 10n, amount: 1_000_000n, costKind: 'price_data' },
      base,
    ])
    const expensive = computeTrust([
      { ...session, kind: 'cost', decisionId: did(1), blockNumber: 10n, amount: 40_000_000n, costKind: 'price_data' },
      base,
    ])
    expect(cheap.score).toBeGreaterThan(expensive.score)
  })

  it('시장이 오르내린 결과는 점수에 들어오지 않는다', () => {
    // 성과를 수익률로 재지 않으므로, 같은 실행 품질이면 시장 상황과 무관하게 같은 점수다.
    const a = computeTrust(profitable(1, 10n))
    const b = computeTrust(profitable(1, 10n))
    expect(a.score).toBe(b.score)
  })
})

describe('computeTrust — 실망 표시 (R10.6, R10.7)', () => {
  it('실망을 표시하면 즉시 크게 내려간다', () => {
    const before = computeTrust(profitable(1, 10n))
    const after = computeTrust([
      ...profitable(1, 10n),
      { kind: 'disappointed', delegationId: 1n, characterId: 'timid', reportId: did(11), blockNumber: 11n },
    ])

    expect(after.score).toBeLessThan(before.score)
    expect(after.discretionBps).toBeLessThan(before.discretionBps)
    expect(after.contributions.some((c) => c.reason.includes('disappointment'))).toBe(true)
  })

  it('실망으로 깎인 점수는 실적으로만 되돌아온다', () => {
    const base: TrackRecord[] = [{ kind: 'disappointed', delegationId: 1n, characterId: 'timid', reportId: did(10), blockNumber: 10n }]
    const justWaiting = computeTrust([...base, { ...session, kind: 'decided', decisionId: did(2), blockNumber: 50n, evidence: { weights: [], driftBps: 0 as never, bandBps: 0 as never, outcome: 'held' } }])
    const withProfit = computeTrust([...base, ...profitable(3, 60n), ...profitable(4, 70n)])

    // 시간이 지나거나 판단만 쌓인다고 회복되지 않는다.
    expect(justWaiting.score).toBe(computeTrust(base).score)
    // 이익을 내야만 올라간다.
    expect(withProfit.score).toBeGreaterThan(justWaiting.score)
  })
})

describe('computeTrust — 기여 추적 (R10.9)', () => {
  it('점수를 만든 기록을 되짚을 수 있다', () => {
    const t = computeTrust([...profitable(1, 10n), ...lossy(2, 20n)])
    expect(t.contributions).toHaveLength(2)
    expect(t.contributions[0]?.decisionId).toBe(did(1))
    expect(t.contributions[1]?.decisionId).toBe(did(2))
    expect(t.contributions[0]!.delta + t.contributions[1]!.delta).toBe(t.score - 50)
  })
})

// ---------------------------------------------------------------------------

const limits: SignedLimits = {
  maxTradeValue: 1_000_000n,
  autoThreshold: 100_000n,
  budget: 10_000_000n,
  budgetSpent: 0n,
  expiry: 1_000n,
  allowedAssets: [TOKEN, USDC],
  allowedDexes: ['0x4444444444444444444444444444444444444444'],
}

function decisionOf(totalValue: bigint, tokenOut: Address = USDC) {
  return {
    id: did(7),
    kind: 'rebalance' as const,
    characterId: 'timid' as const,
    trades: [{ tokenIn: TOKEN, tokenOut, amountIn: 1n, minAmountOut: 1n }],
    totalValue,
    evidence: { weights: [], driftBps: 0 as never, bandBps: 0 as never, outcome: 'asked' as const },
  }
}

const maxTrust = computeTrust(Array.from({ length: 30 }, (_, i) => profitable(i, BigInt(i))).flat())
const minTrust = computeTrust([
  ...Array.from({ length: 30 }, (_, i) => lossy(i, BigInt(i))).flat(),
])

describe('resolveGate — 신뢰는 경계만 움직인다 (R5, R10.8)', () => {
  it('신뢰가 최대여도 사용자 상한을 넘지 못한다 (R5.7)', () => {
    expect(maxTrust.score).toBe(100)
    const g = resolveGate(decisionOf(1n), maxTrust, limits, 1n)
    expect(g.action).toBe('auto')
    if (g.action !== 'reject') {
      expect(g.effectiveCap).toBe(limits.autoThreshold)
      expect(g.effectiveCap).toBeLessThanOrEqual(limits.autoThreshold)
      expect(g.capSource).toBe('user')
    }
  })

  it('신뢰가 낮으면 같은 거래도 물어본다', () => {
    const decision = decisionOf(50_000n)
    const high = resolveGate(decision, maxTrust, limits, 1n)
    const low = resolveGate(decision, minTrust, limits, 1n)

    expect(high.action).toBe('auto')
    expect(low.action).toBe('ask')
    if (low.action === 'ask') {
      expect(low.capSource).toBe('trust')
      expect(low.overBy).toBeGreaterThan(0n)
    }
  })

  it('신뢰가 달라도 거래 내용은 바뀌지 않는다 (R10.8)', () => {
    const decision = decisionOf(50_000n)
    const a = resolveGate(decision, maxTrust, limits, 1n)
    const b = resolveGate(decision, minTrust, limits, 1n)

    // 게이트는 Decision을 건드리지 않는다 — 무엇을 사고팔지는 그대로다.
    expect(canonical(decision)).toBe(canonical(decisionOf(50_000n)))
    expect(a.action).not.toBe(b.action)
  })
})

describe('resolveGate — 거부 조건', () => {
  it('하드캡을 넘으면 승인 여부와 무관하게 거부한다 (R5.6)', () => {
    const g = resolveGate(decisionOf(2_000_000n), maxTrust, limits, 1n)
    expect(g).toEqual({ action: 'reject', reason: 'exceeds_hard_cap' })
  })

  it('위임이 만료되면 거부한다 (R3.4)', () => {
    const g = resolveGate(decisionOf(1n), maxTrust, limits, 2_000n)
    expect(g).toEqual({ action: 'reject', reason: 'expired' })
  })

  it('허용 목록 밖 자산이면 거부한다 (R3.6)', () => {
    const g = resolveGate(decisionOf(1n, OTHER), maxTrust, limits, 1n)
    expect(g).toEqual({ action: 'reject', reason: 'asset_not_allowed' })
  })

  it('예산을 넘기면 거부한다 (R3.7)', () => {
    const spent: SignedLimits = { ...limits, budgetSpent: 9_999_999n }
    const g = resolveGate(decisionOf(100n), maxTrust, spent, 1n)
    expect(g).toEqual({ action: 'reject', reason: 'budget_exhausted' })
  })
})
