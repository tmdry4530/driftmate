import type { Address, Bps, Bytes32, PortfolioBaseline, TrackRecord } from '@soon/shared'
import { normalizeAddress, sameAddress } from './address.js'
import { bps } from './brand.js'
import { canonical } from './canonical.js'
import { PRICE_SCALE } from './constants.js'
import { sha256Hex } from './sha256.js'

export type PortfolioSnapshot = Readonly<{
  blockNumber: bigint
  targetBalance: bigint
  quoteBalance: bigint
  targetPriceE18: bigint
}>

export type PnlInput = Readonly<{
  vault: Address
  baseline: PortfolioBaseline
  current: PortfolioSnapshot
  operatingSpent: bigint
  records: readonly TrackRecord[]
}>

export type PnlResult = Readonly<{
  status: 'loss' | 'not_loss' | 'cashflow_unknown'
  reportId: Bytes32
  expectedTargetBalance: bigint
  expectedQuoteBalance: bigint
  currentValueQuote: bigint
  netCurrentValueQuote: bigint
  pnlQuote: bigint | null
  pnlBps: Bps | null
}>

export function computePnl(input: PnlInput): PnlResult {
  const { baseline, current, operatingSpent } = input
  if (baseline.valueQuote === 0n) throw new RangeError('baseline value must be positive')

  let expectedTargetBalance = baseline.targetBalance
  let expectedQuoteBalance = baseline.quoteBalance
  for (const record of input.records) {
    if (record.kind !== 'executed' || record.delegationId !== baseline.delegationId) continue
    if (sameAddress(record.tokenIn, baseline.targetAsset) && sameAddress(record.tokenOut, baseline.quoteAsset)) {
      expectedTargetBalance -= record.amountIn
      expectedQuoteBalance += record.amountOut
    } else if (sameAddress(record.tokenIn, baseline.quoteAsset) && sameAddress(record.tokenOut, baseline.targetAsset)) {
      expectedQuoteBalance -= record.amountIn
      expectedTargetBalance += record.amountOut
    } else {
      expectedTargetBalance = -1n
      expectedQuoteBalance = -1n
      break
    }
  }

  const currentValueQuote =
    current.quoteBalance + (current.targetBalance * current.targetPriceE18) / PRICE_SCALE
  const netCurrentValueQuote = currentValueQuote - operatingSpent
  const reportId = `0x${sha256Hex(
    canonical({
      vault: normalizeAddress(input.vault),
      delegationId: baseline.delegationId,
      baseline: {
        characterId: baseline.characterId,
        quoteAsset: normalizeAddress(baseline.quoteAsset),
        pricingDex: normalizeAddress(baseline.pricingDex),
        targetAsset: normalizeAddress(baseline.targetAsset),
        blockNumber: baseline.blockNumber,
        targetBalance: baseline.targetBalance,
        quoteBalance: baseline.quoteBalance,
        targetPriceE18: baseline.targetPriceE18,
        valueQuote: baseline.valueQuote,
      },
      current,
      operatingSpent,
    }),
  )}` as Bytes32

  if (expectedTargetBalance !== current.targetBalance || expectedQuoteBalance !== current.quoteBalance) {
    return {
      status: 'cashflow_unknown',
      reportId,
      expectedTargetBalance,
      expectedQuoteBalance,
      currentValueQuote,
      netCurrentValueQuote,
      pnlQuote: null,
      pnlBps: null,
    }
  }

  const pnlQuote = netCurrentValueQuote - baseline.valueQuote
  return {
    status: pnlQuote < 0n ? 'loss' : 'not_loss',
    reportId,
    expectedTargetBalance,
    expectedQuoteBalance,
    currentValueQuote,
    netCurrentValueQuote,
    pnlQuote,
    pnlBps: bps(Number((pnlQuote * 10_000n) / baseline.valueQuote)),
  }
}
