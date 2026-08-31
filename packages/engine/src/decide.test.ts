import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Address, DecisionInput, Holding, PriceSnapshot } from '@soon/shared'
import { bps } from './brand.js'
import { canonical } from './canonical.js'
import { characterOf } from './characters.js'
import { decide } from './decide.js'
import { sha256Hex } from './sha256.js'

const TOKEN: Address = '0x1111111111111111111111111111111111111111'
const USDC: Address = '0x2222222222222222222222222222222222222222'
const POOL: Address = '0x3333333333333333333333333333333333333333'

/**
 * TOKEN은 18 decimals, USDC는 6 decimals.
 * priceE18은 "asset 1 최소단위당 quote 최소단위 × 1e18"이므로
 * TOKEN 1개 = 2000 USDC 이면 2e9가 된다.
 */
const PRICE_2000 = 2_000_000_000n
const PRICE_2400 = 2_400_000_000n

const holdings: readonly Holding[] = [
  { asset: TOKEN, amount: 3_000_000_000_000_000_000n, decimals: 18 }, // 3개 = $6000
  { asset: USDC, amount: 4_000_000_000n, decimals: 6 }, //              $4000
]

function snapshot(tokenPrice: bigint, blockNumber = 100n): PriceSnapshot {
  return {
    blockNumber,
    pool: POOL,
    quoteAsset: USDC,
    prices: [
      { asset: TOKEN, priceE18: tokenPrice },
      { asset: USDC, priceE18: 1_000_000_000_000_000_000n },
    ],
    maxAgeBlocks: 10n,
  }
}

function input(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    target: {
      weights: [
        { asset: TOKEN, bps: bps(6_000) },
        { asset: USDC, bps: bps(4_000) },
      ],
    },
    strategy: characterOf('timid'),
    holdings,
    price: snapshot(PRICE_2400),
    costEstimate: { gasValue: 1_000_000n, slippageValue: 1_000_000n, operatingValue: 500_000n },
    currentBlock: 105n,
    slippageToleranceBps: bps(50),
    ...overrides,
  }
}

describe('sha256 — 직접 구현이므로 표준 벡터로 검증한다', () => {
  it('알려진 해시값과 일치한다', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(sha256Hex('a'.repeat(1000))).toBe(
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
    )
  })

  it('한글도 UTF-8로 안정적으로 처리한다', () => {
    expect(sha256Hex('겁 많은 아이')).toBe(sha256Hex('겁 많은 아이'))
    expect(sha256Hex('겁 많은 아이')).not.toBe(sha256Hex('느긋한 아이'))
  })
})

describe('canonical — 결정론적 직렬화', () => {
  it('키 순서가 달라도 같은 문자열이 나온다', () => {
    expect(canonical({ b: 1n, a: 2n })).toBe(canonical({ a: 2n, b: 1n }))
  })

  it('소수를 거부한다', () => {
    // 비율에 소수가 들어오면 반올림 차이로 판단이 갈릴 수 있다.
    expect(() => canonical({ x: 0.1 })).toThrow(RangeError)
  })
})

describe('decide — 결정론 (R4.1, R4.5)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('같은 입력을 1000번 넣어도 같은 결과가 나온다', () => {
    const first = canonical(decide(input()))
    for (let i = 0; i < 1000; i++) {
      expect(canonical(decide(input()))).toBe(first)
    }
  })

  it('시스템 시계를 바꿔도 결과가 같다', () => {
    const before = canonical(decide(input()))

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2019-01-01T00:00:00Z'))
    const past = canonical(decide(input()))
    vi.setSystemTime(new Date('2088-12-31T23:59:59Z'))
    const future = canonical(decide(input()))

    expect(past).toBe(before)
    expect(future).toBe(before)
  })

  it('DecisionId가 입력에 따라 갈린다', () => {
    const a = decide(input())
    const b = decide(input({ currentBlock: 106n }))
    expect(a.id).toMatch(/^0x[0-9a-f]{64}$/)
    expect(a.id).not.toBe(b.id)
  })
})

describe('decide — 밴드 판정 (R4.2, R4.3)', () => {
  it('밴드 안이면 거래를 만들지 않는다', () => {
    // 가격이 그대로면 60/40이 유지되어 이탈이 0이다.
    const d = decide(input({ price: snapshot(PRICE_2000) }))
    expect(d.kind).toBe('hold')
    expect(d.trades).toHaveLength(0)
    expect(d.skipReason).toBe('within_band')
  })

  it('느긋한 캐릭터는 같은 이탈을 그냥 둔다', () => {
    // 이탈 429bp — timid(300bp)는 움직이고 easygoing(1000bp)은 두어야 한다.
    const timid = decide(input({ strategy: characterOf('timid') }))
    const easy = decide(input({ strategy: characterOf('easygoing') }))

    expect(timid.evidence.driftBps).toBe(easy.evidence.driftBps)
    expect(timid.kind).toBe('rebalance')
    expect(easy.kind).toBe('hold')
  })

  it('밴드를 벗어나면 목표로 되돌리는 거래를 만든다', () => {
    const d = decide(input())
    expect(d.kind).toBe('rebalance')
    expect(d.trades).toHaveLength(1)

    const [trade] = d.trades
    expect(trade?.tokenIn).toBe(TOKEN) // 오른 쪽을 판다
    expect(trade?.tokenOut).toBe(USDC)
    // $11,200 중 60%는 $6,720. 현재 $7,200이므로 $480어치를 옮긴다.
    expect(d.totalValue).toBe(480_000_000n)
    expect(trade?.amountIn).toBe(200_000_000_000_000_000n) // 0.2 TOKEN
  })

  it('슬리피지 허용치가 minAmountOut에 반영된다 (R6.4)', () => {
    const d = decide(input({ slippageToleranceBps: bps(100) })) // 1%
    const [trade] = d.trades
    expect(trade?.minAmountOut).toBe((480_000_000n * 9_900n) / 10_000n)
  })
})

describe('decide — 실행하지 않는 경우', () => {
  it('비용이 옮기는 금액을 넘으면 하지 않는다 (R4.7)', () => {
    const d = decide(
      input({
        costEstimate: {
          gasValue: 200_000_000n,
          slippageValue: 200_000_000n,
          operatingValue: 100_000_000n, // 합 $500 > 옮길 $480
        },
      }),
    )
    expect(d.kind).toBe('skip')
    expect(d.skipReason).toBe('cost_exceeds_benefit')
    expect(d.trades).toHaveLength(0)
  })

  it('운영비만으로도 이득을 넘기면 하지 않는다', () => {
    // 데이터를 사는 값이 교정 이득보다 크면 그 자체로 무의미하다.
    const d = decide(
      input({
        costEstimate: { gasValue: 0n, slippageValue: 0n, operatingValue: 500_000_000n },
      }),
    )
    expect(d.skipReason).toBe('cost_exceeds_benefit')
  })

  it('가격이 오래되면 판단하지 않는다 (R4.6)', () => {
    const d = decide(input({ currentBlock: 200n })) // maxAge 10블록을 한참 넘김
    expect(d.kind).toBe('skip')
    expect(d.skipReason).toBe('stale_price')
    expect(d.trades).toHaveLength(0)
  })

  it('옮길 금액이 최소 거래액에 못 미치면 하지 않는다', () => {
    const d = decide(
      input({
        strategy: { ...characterOf('timid'), minTradeValue: 1_000_000_000n }, // $1000
      }),
    )
    expect(d.skipReason).toBe('below_min_trade')
  })

  it('목표 비중 합이 100%가 아니면 거부한다 (R3.1)', () => {
    expect(() =>
      decide(
        input({
          target: {
            weights: [
              { asset: TOKEN, bps: bps(6_000) },
              { asset: USDC, bps: bps(3_000) },
            ],
          },
        }),
      ),
    ).toThrow(RangeError)
  })
})

describe('decide — 판단 근거 (R4.4)', () => {
  it('근거에 현재·목표 비중과 이탈폭이 담긴다', () => {
    const d = decide(input())

    // 비중은 내림으로 계산한다. TOKEN 6428(-428), USDC 3571(-429)이 되어
    // 두 편차가 1bp 어긋나고, 이탈폭은 둘 중 큰 쪽을 쓴다.
    expect(d.evidence.driftBps).toBe(429)
    expect(d.evidence.bandBps).toBe(300)
    expect(d.evidence.weights).toHaveLength(2)

    const token = d.evidence.weights.find((w) => w.asset === TOKEN)
    expect(token?.currentBps).toBe(6_428)
    expect(token?.targetBps).toBe(6_000)

    const usdc = d.evidence.weights.find((w) => w.asset === USDC)
    expect(usdc?.currentBps).toBe(3_571)
  })
})
