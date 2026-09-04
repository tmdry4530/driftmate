import { describe, expect, it } from 'vitest'
import { parsePercentBps, parseUsd, sameDelegation, validateDraft, type DraftInput, type SignedDelegation } from './delegationDraft.js'

function input(over: Partial<DraftInput> = {}): DraftInput {
  return {
    weightPercent: '60',
    maxTrade: '1000',
    autoThreshold: '300',
    budget: '5000',
    operatingCap: '50',
    days: '30',
    approvalTtlMinutes: '60',
    slippagePercent: '1',
    ...over,
  }
}

describe('parseUsd', () => {
  it('달러 표기를 최소단위로 옮긴다', () => {
    expect(parseUsd('1000')).toBe(1_000_000_000n)
    expect(parseUsd('0.5')).toBe(500_000n)
    expect(parseUsd('1.234567')).toBe(1_234_567n)
  })

  it('숫자가 아니면 거부한다', () => {
    for (const bad of ['', 'abc', '-5', '1.2345678', '1,000', ' ']) {
      expect(parseUsd(bad)).toBeUndefined()
    }
  })
})

describe('parsePercentBps', () => {
  it('퍼센트를 basis point로 옮긴다', () => {
    expect(parsePercentBps('1')).toBe(100)
    expect(parsePercentBps('0.25')).toBe(25)
    expect(parsePercentBps('100')).toBe(10_000)
  })

  it('범위와 정밀도를 넘으면 거부한다', () => {
    for (const bad of ['', '-1', '0.001', '100.01', 'abc']) expect(parsePercentBps(bad)).toBeUndefined()
  })
})

describe('validateDraft — 비중 (R3.1)', () => {
  it('두 자산 비중의 합이 항상 100%가 된다', () => {
    const v = validateDraft(input({ weightPercent: '60' }))
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.draft.tokenWeightBps + v.draft.quoteWeightBps).toBe(10_000)
      expect(v.draft.tokenWeightBps).toBe(6_000)
    }
  })

  it('범위를 벗어난 비중을 거부한다', () => {
    for (const bad of ['101', '-1', '60.5', 'abc']) {
      const v = validateDraft(input({ weightPercent: bad }))
      expect(v.ok).toBe(false)
    }
  })

  it('0%와 100%는 허용한다', () => {
    expect(validateDraft(input({ weightPercent: '0' })).ok).toBe(true)
    expect(validateDraft(input({ weightPercent: '100' })).ok).toBe(true)
  })
})

describe('validateDraft — 한도 관계', () => {
  it('자동 실행 임계값이 하드캡을 넘으면 거부한다 (R5.6)', () => {
    const v = validateDraft(input({ maxTrade: '100', autoThreshold: '500' }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.errors.some((e) => e.includes('cannot exceed'))).toBe(true)
  })

  it('운영비 한도가 예산을 넘으면 거부한다 (R3.7)', () => {
    // 운영비는 거래와 같은 예산을 쓴다. 별도 주머니처럼 잡을 수 없다.
    const v = validateDraft(input({ budget: '100', operatingCap: '500' }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.errors.some((e) => e.includes('within the total budget'))).toBe(true)
  })

  it('예산이 0이면 거부한다', () => {
    expect(validateDraft(input({ budget: '0', operatingCap: '0' })).ok).toBe(false)
  })

  it('임계값이 하드캡과 같은 것은 허용한다', () => {
    expect(validateDraft(input({ maxTrade: '1000', autoThreshold: '1000' })).ok).toBe(true)
  })
})

describe('validateDraft — 기간', () => {
  it('1일 미만을 거부한다', () => {
    expect(validateDraft(input({ days: '0' })).ok).toBe(false)
    expect(validateDraft(input({ days: '-3' })).ok).toBe(false)
  })

  it('승인 TTL과 슬리피지를 온체인 단위로 바꾼n다', () => {
    const v = validateDraft(input({ approvalTtlMinutes: '15', slippagePercent: '0.75' }))
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.draft.approvalTtlSeconds).toBe(900n)
      expect(v.draft.slippageToleranceBps).toBe(75)
    }
  })

  it('잘못된 승인 TTL과 슬리피지를 거부한다', () => {
    expect(validateDraft(input({ approvalTtlMinutes: '0' })).ok).toBe(false)
    expect(validateDraft(input({ slippagePercent: '101' })).ok).toBe(false)
  })

  it('오류를 한 번에 모아서 알려준다', () => {
    const v = validateDraft(input({ weightPercent: '200', budget: 'x', days: '0' }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.errors.length).toBeGreaterThanOrEqual(3)
  })
})

describe('sameDelegation', () => {
  const address = ('0x' + '11'.repeat(20)) as `0x${string}`
  const hash = ('0x' + '22'.repeat(32)) as `0x${string}`
  const delegation: SignedDelegation = {
    executor: address, characterId: hash, strategyHash: hash, trustFormulaVersion: 1,
    quoteAsset: address, maxTradeValue: 10n, autoThreshold: 5n, budget: 20n,
    operatingCap: 2n, expiry: 100n, approvalTtlSeconds: 60n, slippageToleranceBps: 100,
    targetAsset: address, targetAssetBps: 6_000, allowedAssets: [address, address], allowedDexes: [address],
  }

  it('모든 온체인 필드가 같을 때만 round-trip을 통과한다', () => {
    expect(sameDelegation(delegation, delegation)).toBe(true)
    expect(sameDelegation(delegation, { ...delegation, approvalTtlSeconds: 61n })).toBe(false)
    expect(sameDelegation(delegation, { ...delegation, allowedDexes: [] })).toBe(false)
  })
})
