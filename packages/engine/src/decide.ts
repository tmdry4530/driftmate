import type {
  Address,
  Bps,
  Decision,
  DecisionEvidence,
  DecisionInput,
  DecisionId,
  TradeIntent,
  WeightSnapshot,
} from '@soon/shared'
import { normalizeAddress } from './address.js'
import { bps } from './brand.js'
import { canonical } from './canonical.js'
import { BPS_DENOMINATOR, PRICE_SCALE } from './constants.js'
import { sha256Hex } from './sha256.js'

const BPS_D = BigInt(BPS_DENOMINATOR)

/** 자산별 계산 중간값. */
type Leg = {
  asset: Address
  amount: bigint
  price: bigint
  value: bigint
  currentBps: Bps
  targetBps: Bps
  targetValue: bigint
  delta: bigint // 양수 = 사야 함, 음수 = 팔아야 함
}

function decisionId(input: DecisionInput): DecisionId {
  return `0x${sha256Hex(canonical(input))}`
}

function absBigInt(v: bigint): bigint {
  return v < 0n ? -v : v
}

/** 자산 주소 기준 오름차순. 동률 처리에 쓰여 결과 순서를 고정한다. */
function byAsset(a: { asset: Address }, b: { asset: Address }): number {
  return a.asset < b.asset ? -1 : a.asset > b.asset ? 1 : 0
}

function evidenceOf(
  legs: readonly Leg[],
  driftBps: Bps,
  bandBps: Bps,
  outcome: DecisionEvidence['outcome'],
): DecisionEvidence {
  const weights: WeightSnapshot[] = legs.map((l) => ({
    asset: l.asset,
    currentBps: l.currentBps,
    targetBps: l.targetBps,
  }))
  return { weights, driftBps, bandBps, outcome }
}

/**
 * 리밸런싱 판단.
 *
 * 순수 함수다 — 네트워크·시계·난수를 쓰지 않고 입력만 본다 (R4.1, R4.5).
 * 신뢰 점수를 인자로 받지 않으므로 신뢰가 결과를 바꿀 수 없다 (R4.8).
 */
export function decide(input: DecisionInput): Decision {
  const { target, strategy, holdings, price, costEstimate, currentBlock } = input
  const id = decisionId(input)
  const base = { id, characterId: strategy.characterId } as const

  const targetSum = target.weights.reduce((acc, w) => acc + (w.bps as number), 0)
  if (targetSum !== BPS_DENOMINATOR) {
    throw new RangeError(`target weights must sum to ${BPS_DENOMINATOR}, got ${targetSum}`)
  }

  // 가격이 오래되었으면 판단하지 않는다 (R4.6).
  if (currentBlock - price.blockNumber > price.maxAgeBlocks) {
    const empty = evidenceOf([], bps(0), strategy.bandBps, 'skipped')
    return { ...base, kind: 'skip', trades: [], totalValue: 0n, evidence: empty, skipReason: 'stale_price' }
  }

  const priceOf = new Map(price.prices.map((p) => [normalizeAddress(p.asset), p.priceE18]))
  const targetOf = new Map(target.weights.map((w) => [normalizeAddress(w.asset), w.bps]))

  // 자산별 평가액. priceE18은 최소단위당 가격이라 decimals 보정이 필요 없다.
  const valued = holdings
    .map((h) => {
      const p = priceOf.get(normalizeAddress(h.asset))
      if (p === undefined) {
        throw new RangeError(`price missing for asset ${h.asset}`)
      }
      return { asset: h.asset, amount: h.amount, price: p, value: (h.amount * p) / PRICE_SCALE }
    })
    .sort(byAsset)

  const total = valued.reduce((acc, v) => acc + v.value, 0n)
  if (total === 0n) {
    const empty = evidenceOf([], bps(0), strategy.bandBps, 'held')
    return { ...base, kind: 'hold', trades: [], totalValue: 0n, evidence: empty, skipReason: 'within_band' }
  }

  const legs: Leg[] = valued.map((v) => {
    const targetBps = targetOf.get(normalizeAddress(v.asset)) ?? bps(0)
    const currentBps = bps(Number((v.value * BPS_D) / total))
    return {
      ...v,
      currentBps,
      targetBps,
      targetValue: 0n,
      delta: 0n,
    }
  })

  const driftBps = bps(
    legs.reduce((max, l) => Math.max(max, Math.abs((l.currentBps as number) - (l.targetBps as number))), 0),
  )

  // 밴드 안이면 아무 거래도 만들지 않는다 (R4.3).
  if ((driftBps as number) <= (strategy.bandBps as number)) {
    return {
      ...base,
      kind: 'hold',
      trades: [],
      totalValue: 0n,
      evidence: evidenceOf(legs, driftBps, strategy.bandBps, 'held'),
      skipReason: 'within_band',
    }
  }

  // 어디까지 되돌릴지는 캐릭터가 정한다.
  // to_target: 목표 비중까지 / to_band_edge: 밴드 경계까지만 (거래를 덜 만든다)
  const band = strategy.bandBps as number
  for (const leg of legs) {
    const t = leg.targetBps as number
    const c = leg.currentBps as number
    const goalBps =
      strategy.rebalanceStyle === 'to_target' ? t : c > t ? t + band : c < t ? t - band : t
    leg.targetValue = (total * BigInt(goalBps)) / BPS_D
    leg.delta = leg.targetValue - leg.value
  }

  const sellers = legs.filter((l) => l.delta < 0n).sort((a, b) => {
    const d = absBigInt(b.delta) - absBigInt(a.delta)
    return d > 0n ? 1 : d < 0n ? -1 : byAsset(a, b)
  })
  const buyers = legs.filter((l) => l.delta > 0n).sort((a, b) => {
    const d = b.delta - a.delta
    return d > 0n ? 1 : d < 0n ? -1 : byAsset(a, b)
  })

  const sellTotal = sellers.reduce((acc, l) => acc + absBigInt(l.delta), 0n)
  const buyTotal = buyers.reduce((acc, l) => acc + l.delta, 0n)
  // 옮겨지는 금액. 양쪽 중 작은 쪽이 실제로 성사되는 규모다.
  const movedValue = sellTotal < buyTotal ? sellTotal : buyTotal

  if (movedValue < strategy.minTradeValue) {
    return {
      ...base,
      kind: 'skip',
      trades: [],
      totalValue: movedValue,
      evidence: evidenceOf(legs, driftBps, strategy.bandBps, 'skipped'),
      skipReason: 'below_min_trade',
    }
  }

  // 교정으로 옮기는 금액보다 드는 값이 크면 하지 않는다 (R4.7).
  // 운영비까지 포함해 계산하므로, 데이터를 사는 값이 이득을 넘으면 여기서 걸린다.
  const cost =
    costEstimate.gasValue + costEstimate.slippageValue + costEstimate.operatingValue
  if (cost >= movedValue) {
    return {
      ...base,
      kind: 'skip',
      trades: [],
      totalValue: movedValue,
      evidence: evidenceOf(legs, driftBps, strategy.bandBps, 'skipped'),
      skipReason: 'cost_exceeds_benefit',
    }
  }

  // 매도분과 매수분을 큰 것부터 맞물린다. 정렬이 고정이라 같은 입력이면 같은 순서가 나온다.
  const trades: TradeIntent[] = []
  const slip = BigInt(BPS_DENOMINATOR - (input.slippageToleranceBps as number))
  let si = 0
  let bi = 0
  let sellLeft = sellers[0] ? absBigInt(sellers[0].delta) : 0n
  let buyLeft = buyers[0] ? buyers[0].delta : 0n

  while (si < sellers.length && bi < buyers.length) {
    const seller = sellers[si] as Leg
    const buyer = buyers[bi] as Leg
    const chunk = sellLeft < buyLeft ? sellLeft : buyLeft
    if (chunk > 0n) {
      const amountIn = (chunk * PRICE_SCALE) / seller.price
      const expectedOut = (chunk * PRICE_SCALE) / buyer.price
      trades.push({
        tokenIn: seller.asset,
        tokenOut: buyer.asset,
        amountIn,
        minAmountOut: (expectedOut * slip) / BPS_D,
      })
    }
    sellLeft -= chunk
    buyLeft -= chunk
    if (sellLeft === 0n) {
      si++
      sellLeft = sellers[si] ? absBigInt((sellers[si] as Leg).delta) : 0n
    }
    if (buyLeft === 0n) {
      bi++
      buyLeft = buyers[bi] ? (buyers[bi] as Leg).delta : 0n
    }
  }

  return {
    ...base,
    kind: 'rebalance',
    trades,
    totalValue: movedValue,
    // 실행 여부는 게이트와 볼트가 정한다. 여기서는 아직 미확정이라 'asked'로 둔다.
    evidence: evidenceOf(legs, driftBps, strategy.bandBps, 'asked'),
  }
}
