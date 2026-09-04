import { describe, expect, it } from 'vitest'

import {
  CHARACTER_CATALOG_VERSION,
  TRUST_FORMULA_VERSION,
  bps,
  characterOf,
  computeTrust,
  decide,
} from '../../engine/src/index.js'
import { ReceiptStatus, pureCircuits } from '../managed/character-mandate/contract/index.js'
import {
  CharacterMandateSimulator,
  type DecisionProofInput,
  type OpenRelationshipInput,
} from './simulator.js'

const TOKEN = '0x1111111111111111111111111111111111111111' as const
const USDC = '0x2222222222222222222222222222222222222222' as const
const POOL = '0x3333333333333333333333333333333333333333' as const
const zero = new Uint8Array(32)
const bytes = (value: number): Uint8Array => new Uint8Array(32).fill(value)

const hexBytes = (value: `0x${string}`): Uint8Array =>
  Uint8Array.from(value.slice(2).match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16))

const mandate = (
  characterId: 1n | 2n = 1n,
  autoThreshold = 1_000_000_000n,
): OpenRelationshipInput => ({
  characterId,
  targetWeightBps: 6_000n,
  allowedDriftBps: characterId === 1n ? 300n : 1_000n,
  autoThreshold,
  budget: 10_000_000_000n,
  expiry: 2_000_000_000n,
  nonce: bytes(7),
  relationshipNonce: bytes(8),
})

const divmod = (dividend: bigint, divisor: bigint): readonly [bigint, bigint] => [
  dividend / divisor,
  dividend % divisor,
]

const proofInput = (
  relation: OpenRelationshipInput,
  decisionId = bytes(9),
  trustScore = 50n,
  historyDigest: Uint8Array = zero,
): DecisionProofInput => {
  const valueA = 7_200_000_000n
  const valueB = 4_000_000_000n
  const total = valueA + valueB
  const [currentWeightA, currentWeightARemainder] = divmod(valueA * 10_000n, total)
  const [currentWeightB, currentWeightBRemainder] = divmod(valueB * 10_000n, total)
  const goalA =
    relation.characterId === 1n
      ? relation.targetWeightBps
      : currentWeightA > relation.targetWeightBps
        ? relation.targetWeightBps + relation.allowedDriftBps
        : relation.targetWeightBps - relation.allowedDriftBps
  const [targetValueA, targetValueARemainder] = divmod(total * goalA, 10_000n)
  const [targetValueB, targetValueBRemainder] = divmod(total * (10_000n - goalA), 10_000n)
  const discretionBps = 1_000n + trustScore * 90n
  const [effectiveCap, effectiveCapRemainder] = divmod(
    relation.autoThreshold * discretionBps,
    10_000n,
  )
  return {
    decisionId,
    characterId: relation.characterId,
    targetWeightBps: relation.targetWeightBps,
    allowedDriftBps: relation.allowedDriftBps,
    autoThreshold: relation.autoThreshold,
    budget: relation.budget,
    expiry: relation.expiry,
    mandateNonce: relation.nonce,
    spent: 0n,
    trustScore,
    historyDigest,
    relationshipNonce: relation.relationshipNonce,
    currentTimestamp: 1_900_000_000n,
    valueA,
    valueB,
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
    totalCost: 2_500_000n,
  }
}

const engineDecision = () =>
  decide({
    target: {
      weights: [
        { asset: TOKEN, bps: bps(6_000) },
        { asset: USDC, bps: bps(4_000) },
      ],
    },
    strategy: characterOf('timid'),
    holdings: [
      { asset: TOKEN, amount: 3_000_000_000_000_000_000n, decimals: 18 },
      { asset: USDC, amount: 4_000_000_000n, decimals: 6 },
    ],
    price: {
      blockNumber: 100n,
      pool: POOL,
      quoteAsset: USDC,
      prices: [
        { asset: TOKEN, priceE18: 2_400_000_000n },
        { asset: USDC, priceE18: 1_000_000_000_000_000_000n },
      ],
      maxAgeBlocks: 10n,
    },
    costEstimate: {
      gasValue: 1_000_000n,
      slippageValue: 1_000_000n,
      operatingValue: 500_000n,
    },
    currentBlock: 105n,
    slippageToleranceBps: bps(50),
  })

describe('engine ↔ Compact golden vectors', () => {
  it('proves the deterministic timid decision and rejects replay', () => {
    const decision = engineDecision()
    const relation = mandate()
    const simulator = new CharacterMandateSimulator(bytes(1))
    simulator.open(relation)
    const input = proofInput(relation, hexBytes(decision.id))
    const ledger = simulator.prove(input)

    expect(CHARACTER_CATALOG_VERSION).toBe(1)
    expect(TRUST_FORMULA_VERSION).toBe('v1')
    expect(decision.totalValue).toBe(480_000_000n)
    expect(ledger.lastReceipt.status).toBe(ReceiptStatus.PROVED_AUTO_ELIGIBLE)
    expect(() => simulator.prove(input)).toThrow('failed assert: decision already used')
  })

  it('holds the same snapshot for the easygoing character', () => {
    const relation = mandate(2n)
    const simulator = new CharacterMandateSimulator(bytes(1))
    simulator.open(relation)
    const ledger = simulator.prove(proofInput(relation))
    expect(ledger.lastReceipt.status).toBe(ReceiptStatus.HELD)
    expect(ledger.pendingDecisionId.is_some).toBe(false)
  })

  it('rejects mandate substitution and forged quotient data', () => {
    const relation = mandate()
    const simulator = new CharacterMandateSimulator(bytes(1))
    simulator.open(relation)
    expect(() =>
      simulator.prove({ ...proofInput(relation), characterId: 2n, allowedDriftBps: 1_000n }),
    ).toThrow('failed assert: mandate commitment mismatch')
    expect(() =>
      simulator.prove({
        ...proofInput(relation, bytes(10)),
        currentWeightARemainder: proofInput(relation).currentWeightARemainder + 1n,
      }),
    ).toThrow('failed assert: invalid asset A weight')
  })

  it('requires the owner when trust-adjusted discretion is too small', () => {
    const relation = mandate(1n, 100_000_000n)
    const decisionId = bytes(11)
    const simulator = new CharacterMandateSimulator(bytes(1))
    simulator.open(relation)
    expect(simulator.prove(proofInput(relation, decisionId)).lastReceipt.status).toBe(
      ReceiptStatus.OWNER_REQUIRED,
    )
    simulator.switchOwner(bytes(2))
    expect(() => simulator.resolve(decisionId, true)).toThrow(
      'failed assert: owner authentication failed',
    )
    simulator.switchOwner(bytes(1))
    expect(simulator.resolve(decisionId, false).lastReceipt.status).toBe(
      ReceiptStatus.OWNER_REJECTED,
    )
  })

  it('fails closed for expiry, budget, and stale relationship state', () => {
    const relation = mandate()
    const expired = new CharacterMandateSimulator(bytes(1))
    expired.open(relation)
    expect(() =>
      expired.prove({ ...proofInput(relation), currentTimestamp: relation.expiry + 1n }),
    ).toThrow('failed assert: mandate expired')

    const budgetRelation = { ...mandate(1n, 100_000_000n), budget: 100_000_000n }
    const overBudget = new CharacterMandateSimulator(bytes(1))
    overBudget.open(budgetRelation)
    expect(() =>
      overBudget.prove(proofInput(budgetRelation)),
    ).toThrow('failed assert: budget exceeded')
  })

  it('matches trust transitions and applies disappointment to the next discretion gate', () => {
    const relation = mandate()
    const decision = engineDecision()
    const decisionId = hexBytes(decision.id)
    const sourceDigest = bytes(5)
    const simulator = new CharacterMandateSimulator(bytes(1))
    simulator.open(relation)
    simulator.prove(proofInput(relation, decisionId))

    const efficientTrust = pureCircuits.computeTrustAfterEvent(50n, 1n, 480_000_000n, 1_000_000n, 0n)
    const efficientHistory = pureCircuits.computeHistoryAfter(
      zero,
      decisionId,
      1n,
      sourceDigest,
      efficientTrust,
      480_000_000n,
    )
    simulator.recordEvent({
      decisionId,
      eventKind: 1n,
      oldSpent: 0n,
      oldTrustScore: 50n,
      oldHistoryDigest: zero,
      relationshipNonce: relation.relationshipNonce,
      valueQuote: 480_000_000n,
      frictionQuote: 1_000_000n,
      operatingCost: 0n,
      sourceDigest,
    })
    expect(efficientTrust).toBe(53n)

    const disappointedTrust = pureCircuits.computeTrustAfterEvent(
      efficientTrust,
      4n,
      0n,
      0n,
      0n,
    )
    const disappointedHistory = pureCircuits.computeHistoryAfter(
      efficientHistory,
      decisionId,
      4n,
      bytes(6),
      disappointedTrust,
      480_000_000n,
    )
    simulator.recordEvent({
      decisionId,
      eventKind: 4n,
      oldSpent: 480_000_000n,
      oldTrustScore: efficientTrust,
      oldHistoryDigest: efficientHistory,
      relationshipNonce: relation.relationshipNonce,
      valueQuote: 0n,
      frictionQuote: 0n,
      operatingCost: 0n,
      sourceDigest: bytes(6),
    })
    expect(disappointedTrust).toBe(38n)

    const engineTrust = computeTrust([
      {
        kind: 'executed',
        decisionId: decision.id,
        blockNumber: 1n,
        tokenIn: TOKEN,
        tokenOut: USDC,
        amountIn: 1n,
        amountOut: 1n,
        valueQuote: 480_000_000n,
        frictionQuote: 1_000_000n,
      },
      { kind: 'disappointed', blockNumber: 2n },
    ])
    expect(engineTrust.score).toBe(Number(disappointedTrust))
    expect(engineTrust.discretionBps).toBe(4_420)

    const nextDecision = bytes(12)
    const nextInput = {
      ...proofInput(relation, nextDecision, disappointedTrust, disappointedHistory),
      spent: 480_000_000n,
    }
    expect(simulator.prove(nextInput).lastReceipt.status).toBe(ReceiptStatus.OWNER_REQUIRED)
    expect(() =>
      simulator.recordEvent({
        decisionId,
        eventKind: 4n,
        oldSpent: 480_000_000n,
        oldTrustScore: disappointedTrust,
        oldHistoryDigest: disappointedHistory,
        relationshipNonce: relation.relationshipNonce,
        valueQuote: 0n,
        frictionQuote: 0n,
        operatingCost: 0n,
        sourceDigest: bytes(6),
      }),
    ).toThrow('failed assert: relationship event already used')
  })
})
