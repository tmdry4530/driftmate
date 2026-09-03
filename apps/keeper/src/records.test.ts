import type { Address } from '@soon/shared'
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAbiItem,
  keccak256,
  parseAbi,
  stringToHex,
  type PublicClient,
} from 'viem'
import { describe, expect, it } from 'vitest'
import { vaultAbi } from './abi.js'
import { loadPendingRequest, loadTrackRecords } from './records.js'

const abi = parseAbi(vaultAbi)
const vault = '0x0000000000000000000000000000000000000001' as Address
const token = '0x0000000000000000000000000000000000000002' as Address
const quote = '0x0000000000000000000000000000000000000003' as Address
const dex = '0x0000000000000000000000000000000000000004' as Address
const decisionId = stringToHex('same', { size: 32 })
const lossId = stringToHex('loss', { size: 32 })
type EventItem = Extract<(typeof abi)[number], { type: 'event' }>

function eventLog(eventName: string, args: Record<string, unknown>, blockNumber: bigint) {
  const item = getAbiItem({ abi, name: eventName as never }) as EventItem
  const nonIndexed = item.inputs.filter((input) => !('indexed' in input) || !input.indexed)
  return {
    address: vault,
    blockNumber,
    transactionHash: `0x${blockNumber.toString(16).padStart(64, '0')}` as `0x${string}`,
    topics: encodeEventTopics({ abi, eventName: eventName as never, args: args as never }),
    data: encodeAbiParameters(
      nonIndexed,
      nonIndexed.map((input) => args[input.name]),
    ),
  }
}

describe('loadTrackRecords', () => {
  it('joins by delegation and decision while preserving invalid evidence', async () => {
    const validEvidence = stringToHex(
      JSON.stringify({ weights: [], driftBps: 10, bandBps: 300, outcome: 'held' }),
    )
    const orderHash = stringToHex('order', { size: 32 })
    const evidenceHash = keccak256(validEvidence)
    const logs = [
      eventLog(
        'PortfolioBaseline',
        {
          delegationId: 1n,
          characterId: stringToHex('timid', { size: 32 }),
          quoteAsset: quote,
          pricingDex: dex,
          targetAsset: token,
          targetBalance: 5n,
          quoteBalance: 10n,
          targetPriceE18: 2n * 10n ** 18n,
          valueQuote: 20n,
          blockRef: 1n,
        },
        1n,
      ),
      eventLog(
        'Decided',
        {
          decisionId,
          delegationId: 1n,
          characterId: stringToHex('timid', { size: 32 }),
          trustFormulaVersion: 1,
          blockRef: 2n,
          evidence: '0xff',
        },
        2n,
      ),
      eventLog(
        'Executed',
        {
          decisionId,
          delegationId: 1n,
          tokenIn: token,
          tokenOut: quote,
          amountIn: 50n,
          amountOut: 90n,
          valueInQuote: 100n,
          valueOutQuote: 90n,
        },
        2n,
      ),
      eventLog(
        'CostCharged',
        { decisionId, delegationId: 1n, amount: 5n, kind: 0 },
        2n,
      ),
      eventLog(
        'Decided',
        {
          decisionId,
          delegationId: 2n,
          characterId: stringToHex('easygoing', { size: 32 }),
          trustFormulaVersion: 1,
          blockRef: 3n,
          evidence: validEvidence,
        },
        3n,
      ),
      eventLog(
        'ApprovalRequested',
        {
          decisionId,
          delegationId: 2n,
          dex,
          tokenIn: token,
          tokenOut: quote,
          amountIn: 7n,
          minAmountOut: 6n,
          orderHash,
          evidenceHash,
          expiresAt: 99n,
        },
        3n,
      ),
      eventLog('NotExecuted', { decisionId, delegationId: 2n, reason: 6 }, 3n),
      eventLog(
        'Disappointed',
        {
          delegationId: 2n,
          characterId: stringToHex('easygoing', { size: 32 }),
          reportId: lossId,
          blockRef: 4n,
        },
        4n,
      ),
    ]
    const client = { getLogs: async () => logs } as unknown as PublicClient

    const records = await loadTrackRecords(client, vault)
    const broken = records.find((record) => record.kind === 'decided' && record.delegationId === 1n)
    const executed = records.find((record) => record.kind === 'executed')
    const skipped = records.find((record) => record.kind === 'not_executed')

    expect(broken).toMatchObject({ characterId: 'timid', evidenceError: 'invalid' })
    expect(executed).toMatchObject({ characterId: 'timid', trustFormulaVersion: 1, frictionQuote: 10n })
    expect(skipped).toMatchObject({ delegationId: 2n, characterId: 'easygoing', reason: 'within_band' })
    expect(records.some((record) => record.kind === 'baseline')).toBe(true)
    expect(records.some((record) => record.kind === 'disappointed' && record.reportId === lossId)).toBe(
      true,
    )

    const pending = await loadPendingRequest(client, vault, {
      delegationId: 2n,
      proposalNonce: 1n,
      decisionId,
      orderHash,
      evidenceHash,
      expiresAt: 99n,
      open: true,
    }, 4n)
    expect(pending).toMatchObject({
      blockNumber: 3n,
      dex,
      trade: { tokenIn: token, tokenOut: quote, amountIn: 7n, minAmountOut: 6n },
      evidence: { driftBps: 10 },
    })
  })
})
