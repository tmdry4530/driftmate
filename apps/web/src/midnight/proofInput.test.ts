import { describe, expect, it } from 'vitest'

import { CHARACTER_CATALOG_VERSION, bps, characterOf, decide } from '@soon/engine'
import type { DecisionInput } from '@soon/shared'

import { createPrivateState } from './privateState.js'
import { toProofInput } from './proofInput.js'

const TOKEN = '0x1111111111111111111111111111111111111111' as const
const USDC = '0x2222222222222222222222222222222222222222' as const
const POOL = '0x3333333333333333333333333333333333333333' as const

const input = (): DecisionInput => ({
  target: { weights: [{ asset: TOKEN, bps: bps(6_000) }, { asset: USDC, bps: bps(4_000) }] },
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
  costEstimate: { gasValue: 1_000_000n, slippageValue: 1_000_000n, operatingValue: 500_000n },
  currentBlock: 105n,
  slippageToleranceBps: bps(50),
})

const relationship = () =>
  createPrivateState({
    characterId: 'timid',
    targetWeightBps: 6_000,
    autoThreshold: 1_000_000_000n,
    budget: 10_000_000_000n,
    expiry: 2_000_000_000n,
  })

describe('Midnight proof input adapter', () => {
  it('derives bounded circuit inputs from the deterministic engine decision', () => {
    const decisionInput = input()
    const proof = toProofInput(decide(decisionInput), relationship(), {
      decisionInput,
      currentTimestamp: 1_900_000_000n,
      catalogVersion: CHARACTER_CATALOG_VERSION,
    })
    expect(proof.valueA).toBe(7_200_000_000n)
    expect(proof.valueB).toBe(4_000_000_000n)
    expect(proof.currentWeightA * (proof.valueA + proof.valueB) + proof.currentWeightARemainder)
      .toBe(proof.valueA * 10_000n)
    expect(proof.effectiveCap).toBe(550_000_000n)
  })

  it('rejects forged decisions and incompatible versions', () => {
    const decisionInput = input()
    const decision = decide(decisionInput)
    expect(() =>
      toProofInput({ ...decision, id: `0x${'a'.repeat(64)}` }, relationship(), {
        decisionInput,
        currentTimestamp: 1n,
        catalogVersion: CHARACTER_CATALOG_VERSION,
      }),
    ).toThrow('snapshot')
    expect(() =>
      toProofInput(decision, relationship(), {
        decisionInput,
        currentTimestamp: 1n,
        catalogVersion: 2,
      }),
    ).toThrow('버전')
  })

  it('fails closed for stale prices, overflow, and mandate mismatch', () => {
    const stale = { ...input(), currentBlock: 111n }
    expect(() =>
      toProofInput(decide(stale), relationship(), {
        decisionInput: stale,
        currentTimestamp: 1n,
        catalogVersion: CHARACTER_CATALOG_VERSION,
      }),
    ).toThrow('만료된 가격')

    const huge = input()
    const hugeInput = {
      ...huge,
      holdings: [{ ...huge.holdings[0]!, amount: 1_000_000_000_000_000_000_000_000n }, huge.holdings[1]!],
    }
    expect(() =>
      toProofInput(decide(hugeInput), relationship(), {
        decisionInput: hugeInput,
        currentTimestamp: 1n,
        catalogVersion: CHARACTER_CATALOG_VERSION,
      }),
    ).toThrow('평가액')

    expect(() =>
      toProofInput(decide(input()), { ...relationship(), targetWeightBps: 5_000 }, {
        decisionInput: input(),
        currentTimestamp: 1n,
        catalogVersion: CHARACTER_CATALOG_VERSION,
      }),
    ).toThrow('목표 비중')
  })
})
