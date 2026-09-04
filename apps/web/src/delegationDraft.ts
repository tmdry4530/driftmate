/**
 * Delegation input validation (R3.1, R3.2).
 *
 * Kept as a pure function so input rules remain directly verifiable.
 */
export type DraftInput = Readonly<{
  weightPercent: string
  maxTrade: string
  autoThreshold: string
  budget: string
  operatingCap: string
  days: string
  approvalTtlMinutes: string
  slippagePercent: string
}>

export type DelegationDraft = Readonly<{
  tokenWeightBps: number
  quoteWeightBps: number
  maxTradeValue: bigint
  autoThreshold: bigint
  budget: bigint
  operatingCap: bigint
  days: number
  approvalTtlSeconds: bigint
  slippageToleranceBps: number
}>

/** Parse a decimal USD value with up to six places into base units. */
export function parseUsd(s: string): bigint | undefined {
  const t = s.trim()
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return undefined
  const [whole, frac = ''] = t.split('.')
  return BigInt(whole!) * 1_000_000n + BigInt(frac.padEnd(6, '0'))
}

/** Convert a percentage with up to two decimal places into basis points. */
export function parsePercentBps(s: string): number | undefined {
  const t = s.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined
  const [whole, frac = ''] = t.split('.')
  const value = BigInt(whole!) * 100n + BigInt(frac.padEnd(2, '0'))
  return value <= 10_000n ? Number(value) : undefined
}

export type Validation =
  | { ok: true; draft: DelegationDraft }
  | { ok: false; errors: readonly string[] }

export type SignedDelegation = Readonly<{
  executor: Address
  characterId: Bytes32
  strategyHash: Bytes32
  trustFormulaVersion: number
  quoteAsset: Address
  maxTradeValue: bigint
  autoThreshold: bigint
  budget: bigint
  operatingCap: bigint
  expiry: bigint
  approvalTtlSeconds: bigint
  slippageToleranceBps: number
  targetAsset: Address
  targetAssetBps: number
  allowedAssets: readonly Address[]
  allowedDexes: readonly Address[]
}>

/** Compare the signed delegation with the value read at the receipt block. */
export function sameDelegation(expected: SignedDelegation, actual: SignedDelegation): boolean {
  const hexEqual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  return (
    hexEqual(expected.executor, actual.executor) &&
    hexEqual(expected.characterId, actual.characterId) &&
    hexEqual(expected.strategyHash, actual.strategyHash) &&
    expected.trustFormulaVersion === actual.trustFormulaVersion &&
    hexEqual(expected.quoteAsset, actual.quoteAsset) &&
    expected.maxTradeValue === actual.maxTradeValue &&
    expected.autoThreshold === actual.autoThreshold &&
    expected.budget === actual.budget &&
    expected.operatingCap === actual.operatingCap &&
    expected.expiry === actual.expiry &&
    expected.approvalTtlSeconds === actual.approvalTtlSeconds &&
    expected.slippageToleranceBps === actual.slippageToleranceBps &&
    hexEqual(expected.targetAsset, actual.targetAsset) &&
    expected.targetAssetBps === actual.targetAssetBps &&
    expected.allowedAssets.length === actual.allowedAssets.length &&
    expected.allowedAssets.every((asset, index) => hexEqual(asset, actual.allowedAssets[index]!)) &&
    expected.allowedDexes.length === actual.allowedDexes.length &&
    expected.allowedDexes.every((dex, index) => hexEqual(dex, actual.allowedDexes[index]!))
  )
}

export function validateDraft(input: DraftInput): Validation {
  const errors: string[] = []

  const w = Number(input.weightPercent)
  const weightOk = /^\d+$/.test(input.weightPercent.trim()) && w >= 0 && w <= 100
  if (!weightOk) errors.push('Allocation must be an integer from 0 to 100.')

  const maxTradeValue = parseUsd(input.maxTrade)
  const autoThreshold = parseUsd(input.autoThreshold)
  const budget = parseUsd(input.budget)
  const operatingCap = parseUsd(input.operatingCap)

  if (maxTradeValue === undefined) errors.push('Enter a numeric maximum trade value.')
  if (autoThreshold === undefined) errors.push('Enter a numeric automatic execution limit.')
  if (budget === undefined) errors.push('Enter a numeric total budget.')
  if (operatingCap === undefined) errors.push('Enter a numeric operating-cost cap.')

  // The automatic limit cannot exceed the hard per-trade cap.
  if (maxTradeValue !== undefined && autoThreshold !== undefined && autoThreshold > maxTradeValue) {
    errors.push('The automatic execution limit cannot exceed the maximum trade value.')
  }
  // Operating costs share the total budget with trades (R3.7).
  if (budget !== undefined && operatingCap !== undefined && operatingCap > budget) {
    errors.push('The operating-cost cap must fit within the total budget.')
  }
  if (budget !== undefined && budget === 0n) errors.push('The total budget must be greater than zero.')

  const days = /^\d+$/.test(input.days.trim()) ? BigInt(input.days.trim()) : 0n
  if (days < 1n || days > BigInt(Number.MAX_SAFE_INTEGER)) errors.push('Duration must be at least one day.')

  const approvalTtlMinutes = /^\d+$/.test(input.approvalTtlMinutes.trim())
    ? BigInt(input.approvalTtlMinutes.trim())
    : 0n
  if (approvalTtlMinutes < 1n) errors.push('Approval requests must remain valid for at least one minute.')

  const slippageToleranceBps = parsePercentBps(input.slippagePercent)
  if (slippageToleranceBps === undefined) errors.push('Slippage must be between 0% and 100%, with at most two decimal places.')

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    draft: {
      tokenWeightBps: w * 100,
      quoteWeightBps: 10_000 - w * 100,
      maxTradeValue: maxTradeValue!,
      autoThreshold: autoThreshold!,
      budget: budget!,
      operatingCap: operatingCap!,
      days: Number(days),
      approvalTtlSeconds: approvalTtlMinutes * 60n,
      slippageToleranceBps: slippageToleranceBps!,
    },
  }
}
import type { Address, Bytes32 } from '@soon/shared'
