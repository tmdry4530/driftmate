import {
  CHARACTER_CATALOG_VERSION,
  PRICE_SCALE,
  characterOf,
  decide,
  normalizeAddress,
} from '@soon/engine'
import type { Decision, DecisionInput } from '@soon/shared'
import type { DecisionProofInput } from '../../../../packages/midnight-contract/src/simulator.js'

import type { CharacterRelationshipPrivateState } from './privateState.js'

export type ProofSnapshot = Readonly<{
  decisionInput: DecisionInput
  currentTimestamp: bigint
  catalogVersion: number
}>

const BPS = 10_000n
const MAX_VALUE = 800_000_000_000_000n
const UINT64_MAX = 18_446_744_073_709_551_615n

const divmod = (dividend: bigint, divisor: bigint): readonly [bigint, bigint] => [
  dividend / divisor,
  dividend % divisor,
]

const abs = (value: bigint): bigint => (value < 0n ? -value : value)

const assertBytes32 = (value: Uint8Array, label: string): void => {
  if (value.length !== 32) throw new RangeError(`${label} 길이가 올바르지 않습니다.`)
}

const decisionBytes = (value: string): Uint8Array => {
  if (!/^0x[0-9a-f]{64}$/.test(value)) throw new TypeError('decision ID 형식이 올바르지 않습니다.')
  return Uint8Array.from(value.slice(2).match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16))
}

const assertUint64 = (value: bigint, label: string): void => {
  if (value < 0n || value > UINT64_MAX) throw new RangeError(`${label} 값이 허용 범위를 벗어났습니다.`)
}

export function toProofInput(
  decision: Decision,
  state: CharacterRelationshipPrivateState,
  snapshot: ProofSnapshot,
): DecisionProofInput {
  if (snapshot.catalogVersion !== CHARACTER_CATALOG_VERSION) {
    throw new Error('캐릭터 카탈로그 버전이 일치하지 않습니다.')
  }
  const verifiedDecision = decide(snapshot.decisionInput)
  if (decision.id !== verifiedDecision.id) throw new Error('판단과 snapshot이 일치하지 않습니다.')
  if (state.characterId !== verifiedDecision.characterId) throw new Error('관계 캐릭터가 판단과 일치하지 않습니다.')
  if (verifiedDecision.skipReason === 'stale_price') throw new Error('만료된 가격으로는 proof를 만들 수 없습니다.')

  const strategy = characterOf(state.characterId)
  const { holdings, price, target, costEstimate } = snapshot.decisionInput
  if (holdings.length !== 2 || price.prices.length !== 2 || target.weights.length !== 2) {
    throw new RangeError('Midnight proof는 정확히 두 자산만 지원합니다.')
  }
  if (!Number.isInteger(state.trustScore) || state.trustScore < 0 || state.trustScore > 100) {
    throw new RangeError('신뢰 점수가 허용 범위를 벗어났습니다.')
  }
  if (snapshot.currentTimestamp < 0n || snapshot.currentTimestamp > state.expiry) {
    throw new RangeError('관계가 만료되었거나 시각이 올바르지 않습니다.')
  }
  if (state.autoThreshold <= 0n || state.autoThreshold > state.budget || state.budget > MAX_VALUE) {
    throw new RangeError('위임 한도 또는 예산이 허용 범위를 벗어났습니다.')
  }
  if (state.spent < 0n || state.spent > state.budget) throw new RangeError('누적 예산 상태가 올바르지 않습니다.')
  assertBytes32(state.ownerSecret, 'owner secret')
  assertBytes32(state.commitmentNonce, 'mandate nonce')
  assertBytes32(state.relationshipNonce, 'relationship nonce')
  assertBytes32(state.historyDigest, 'history digest')

  const prices = new Map(price.prices.map((item) => [normalizeAddress(item.asset), item.priceE18]))
  const values = holdings
    .map((holding) => {
      const unitPrice = prices.get(normalizeAddress(holding.asset))
      if (unitPrice === undefined) throw new Error('자산 가격이 누락되었습니다.')
      if (holding.amount < 0n || unitPrice < 0n) throw new RangeError('자산 수량 또는 가격이 올바르지 않습니다.')
      return {
        asset: normalizeAddress(holding.asset),
        value: (holding.amount * unitPrice) / PRICE_SCALE,
      }
    })
    .sort((left, right) => left.asset.localeCompare(right.asset))

  const assetA = values[0]
  const assetB = values[1]
  if (!assetA || !assetB || assetA.asset === assetB.asset) throw new Error('서로 다른 두 자산이 필요합니다.')
  if (assetA.value > MAX_VALUE || assetB.value > MAX_VALUE) throw new RangeError('자산 평가액이 proof 범위를 벗어났습니다.')
  const total = assetA.value + assetB.value
  if (total <= 0n) throw new RangeError('빈 포트폴리오는 proof로 제출할 수 없습니다.')

  const targetA = target.weights.find((item) => normalizeAddress(item.asset) === assetA.asset)
  const targetB = target.weights.find((item) => normalizeAddress(item.asset) === assetB.asset)
  if (!targetA || !targetB || Number(targetA.bps) !== state.targetWeightBps || Number(targetA.bps) + Number(targetB.bps) !== 10_000) {
    throw new Error('관계 목표 비중과 snapshot이 일치하지 않습니다.')
  }

  const [currentWeightA, currentWeightARemainder] = divmod(assetA.value * BPS, total)
  const [currentWeightB, currentWeightBRemainder] = divmod(assetB.value * BPS, total)
  const targetWeightBps = BigInt(state.targetWeightBps)
  const allowedDriftBps = BigInt(Number(strategy.bandBps))
  const goalA =
    state.characterId === 'timid'
      ? targetWeightBps
      : currentWeightA > targetWeightBps
        ? targetWeightBps + allowedDriftBps
        : targetWeightBps - allowedDriftBps
  const [targetValueA, targetValueARemainder] = divmod(total * goalA, BPS)
  const [targetValueB, targetValueBRemainder] = divmod(total * (BPS - goalA), BPS)
  const movedValue = abs(targetValueA - assetA.value) < abs(targetValueB - assetB.value)
    ? abs(targetValueA - assetA.value)
    : abs(targetValueB - assetB.value)
  if (verifiedDecision.kind === 'hold' ? verifiedDecision.totalValue !== 0n : verifiedDecision.totalValue !== movedValue) {
    throw new Error('엔진 판단 금액과 proof 계산이 일치하지 않습니다.')
  }

  const costs = [costEstimate.gasValue, costEstimate.slippageValue, costEstimate.operatingValue]
  if (costs.some((value) => value < 0n)) throw new RangeError('비용은 음수일 수 없습니다.')
  const totalCost = costs.reduce((sum, value) => sum + value, 0n)
  if (totalCost > MAX_VALUE) throw new RangeError('비용이 proof 범위를 벗어났습니다.')
  const discretionBps = 1_000n + BigInt(state.trustScore) * 90n
  const [effectiveCap, effectiveCapRemainder] = divmod(state.autoThreshold * discretionBps, BPS)

  for (const [value, label] of [
    [state.expiry, '만료'],
    [state.spent, '누적 사용액'],
    [snapshot.currentTimestamp, '현재 시각'],
    [effectiveCap, '유효 재량'],
  ] as const) assertUint64(value, label)

  return {
    decisionId: decisionBytes(verifiedDecision.id),
    characterId: state.characterId === 'timid' ? 1n : 2n,
    targetWeightBps,
    allowedDriftBps,
    autoThreshold: state.autoThreshold,
    budget: state.budget,
    expiry: state.expiry,
    mandateNonce: state.commitmentNonce,
    spent: state.spent,
    trustScore: BigInt(state.trustScore),
    historyDigest: state.historyDigest,
    relationshipNonce: state.relationshipNonce,
    currentTimestamp: snapshot.currentTimestamp,
    valueA: assetA.value,
    valueB: assetB.value,
    currentWeightA,
    currentWeightARemainder,
    currentWeightB,
    currentWeightBRemainder,
    targetValueA,
    targetValueARemainder,
    targetValueB,
    targetValueBRemainder,
    effectiveCap,
    effectiveCapRemainder,
    totalCost,
  }
}
