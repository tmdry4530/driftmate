import type { Address, DecisionEvidence, DecisionId, PendingDecision, TrackRecord } from '@soon/shared'
import { decodeEventLog, hexToString, keccak256, parseAbi, type PublicClient } from 'viem'
import { vaultAbi } from './abi.js'
import type { PendingRequest } from './ports.js'

const VAULT_ABI = parseAbi(vaultAbi)

const REASON_NAMES = [
  'rejected',
  'expired',
  'cost_exceeds_benefit',
  'slippage',
  'stale_price',
  'budget_exhausted',
  'within_band',
  'below_min_trade',
  'execution_failed',
] as const

const COST_KIND_NAMES = ['price_data', 'narration'] as const

function decodeBytes32(value: `0x${string}`): string {
  return hexToString(value, { size: 32 }).replace(/\0+$/, '')
}

export function decodeEvidence(hex: `0x${string}`): DecisionEvidence | undefined {
  try {
    const raw = JSON.parse(hexToString(hex).replace(/(\d+)n/g, '$1')) as DecisionEvidence
    return typeof raw?.driftBps === 'number' ? raw : undefined
  } catch {
    return undefined
  }
}

export async function loadPendingRequest(
  client: PublicClient,
  vault: Address,
  pending: PendingDecision,
  toBlock: bigint,
): Promise<PendingRequest | undefined> {
  if (!pending.open) return undefined
  const logs = await client.getLogs({ address: vault, fromBlock: 0n, toBlock })
  let request: Omit<PendingRequest, 'evidence'> | undefined
  let evidence: DecisionEvidence | undefined
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: VAULT_ABI, topics: log.topics as never, data: log.data })
      if (decoded.eventName === 'ApprovalRequested') {
        const args = decoded.args as {
          decisionId: DecisionId
          delegationId: bigint
          dex: Address
          tokenIn: Address
          tokenOut: Address
          amountIn: bigint
          minAmountOut: bigint
          orderHash: `0x${string}`
          evidenceHash: `0x${string}`
          expiresAt: bigint
        }
        if (
          args.delegationId === pending.delegationId &&
          args.decisionId.toLowerCase() === pending.decisionId.toLowerCase() &&
          args.orderHash === pending.orderHash &&
          args.evidenceHash === pending.evidenceHash &&
          args.expiresAt === pending.expiresAt
        ) {
          request = {
            blockNumber: log.blockNumber ?? 0n,
            dex: args.dex,
            trade: {
              tokenIn: args.tokenIn,
              tokenOut: args.tokenOut,
              amountIn: args.amountIn,
              minAmountOut: args.minAmountOut,
            },
          }
        }
      } else if (decoded.eventName === 'Decided') {
        const args = decoded.args as {
          decisionId: DecisionId
          delegationId: bigint
          evidence: `0x${string}`
        }
        if (
          args.delegationId === pending.delegationId &&
          args.decisionId.toLowerCase() === pending.decisionId.toLowerCase() &&
          keccak256(args.evidence) === pending.evidenceHash
        ) {
          evidence = decodeEvidence(args.evidence)
        }
      }
    } catch {
      // 다른 ABI 이벤트는 무시한다.
    }
  }
  return request && evidence ? { ...request, evidence } : undefined
}

function key(delegationId: bigint, decisionId: DecisionId): string {
  return `${delegationId}:${decisionId.toLowerCase()}`
}

type ParsedLog = Readonly<{
  eventName: string
  args: unknown
  blockNumber: bigint
  txHash?: `0x${string}`
}>

export async function loadTrackRecords(
  client: PublicClient,
  vault: Address,
  fromBlock: bigint = 0n,
  toBlock: bigint | 'latest' = 'latest',
): Promise<TrackRecord[]> {
  const logs = await client.getLogs({ address: vault, fromBlock, toBlock })
  const parsed: ParsedLog[] = []
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: VAULT_ABI, topics: log.topics as never, data: log.data })
      parsed.push({
        eventName: decoded.eventName,
        args: decoded.args,
        blockNumber: log.blockNumber ?? 0n,
        ...(log.transactionHash ? { txHash: log.transactionHash } : {}),
      })
    } catch {
      // 다른 이벤트는 트랙레코드가 아니다.
    }
  }

  const links = new Map<string, { characterId: string; trustFormulaVersion: number }>()
  for (const log of parsed) {
    if (log.eventName !== 'Decided') continue
    const args = log.args as {
      decisionId: DecisionId
      delegationId: bigint
      characterId: `0x${string}`
      trustFormulaVersion: number
    }
    links.set(key(args.delegationId, args.decisionId), {
      characterId: decodeBytes32(args.characterId),
      trustFormulaVersion: args.trustFormulaVersion,
    })
  }

  const records: TrackRecord[] = []
  for (const log of parsed) {
    const txRef = log.txHash ? { txHash: log.txHash } : {}
    switch (log.eventName) {
      case 'Decided': {
        const args = log.args as {
          decisionId: DecisionId
          delegationId: bigint
          characterId: `0x${string}`
          trustFormulaVersion: number
          evidence: `0x${string}`
        }
        const evidence = decodeEvidence(args.evidence)
        records.push({
          kind: 'decided',
          delegationId: args.delegationId,
          decisionId: args.decisionId,
          characterId: decodeBytes32(args.characterId),
          trustFormulaVersion: args.trustFormulaVersion,
          blockNumber: log.blockNumber,
          ...(evidence ? { evidence } : { evidenceError: 'invalid' as const }),
          ...txRef,
        })
        break
      }
      case 'Executed': {
        const args = log.args as {
          decisionId: DecisionId
          delegationId: bigint
          tokenIn: Address
          tokenOut: Address
          amountIn: bigint
          amountOut: bigint
          valueInQuote: bigint
          valueOutQuote: bigint
        }
        const link = links.get(key(args.delegationId, args.decisionId)) ?? {
          characterId: 'unknown',
          trustFormulaVersion: 0,
        }
        records.push({
          kind: 'executed',
          delegationId: args.delegationId,
          decisionId: args.decisionId,
          ...link,
          blockNumber: log.blockNumber,
          tokenIn: args.tokenIn,
          tokenOut: args.tokenOut,
          amountIn: args.amountIn,
          amountOut: args.amountOut,
          valueInQuote: args.valueInQuote,
          valueOutQuote: args.valueOutQuote,
          frictionQuote:
            args.valueInQuote > args.valueOutQuote ? args.valueInQuote - args.valueOutQuote : 0n,
          ...txRef,
        })
        break
      }
      case 'NotExecuted': {
        const args = log.args as { decisionId: DecisionId; delegationId: bigint; reason: number }
        const link = links.get(key(args.delegationId, args.decisionId)) ?? {
          characterId: 'unknown',
          trustFormulaVersion: 0,
        }
        records.push({
          kind: 'not_executed',
          delegationId: args.delegationId,
          decisionId: args.decisionId,
          ...link,
          blockNumber: log.blockNumber,
          reason: REASON_NAMES[args.reason] ?? 'cost_exceeds_benefit',
          ...txRef,
        })
        break
      }
      case 'CostCharged': {
        const args = log.args as { decisionId: DecisionId; delegationId: bigint; amount: bigint; kind: number }
        const link = links.get(key(args.delegationId, args.decisionId)) ?? {
          characterId: 'unknown',
          trustFormulaVersion: 0,
        }
        records.push({
          kind: 'cost',
          delegationId: args.delegationId,
          decisionId: args.decisionId,
          ...link,
          blockNumber: log.blockNumber,
          amount: args.amount,
          costKind: COST_KIND_NAMES[args.kind] ?? 'price_data',
          ...txRef,
        })
        break
      }
      case 'Disappointed': {
        const args = log.args as {
          delegationId: bigint
          characterId: `0x${string}`
          reportId: DecisionId
        }
        records.push({
          kind: 'disappointed',
          delegationId: args.delegationId,
          characterId: decodeBytes32(args.characterId),
          reportId: args.reportId,
          blockNumber: log.blockNumber,
          ...txRef,
        })
        break
      }
      case 'PortfolioBaseline': {
        const args = log.args as {
          delegationId: bigint
          characterId: `0x${string}`
          quoteAsset: Address
          pricingDex: Address
          targetAsset: Address
          targetBalance: bigint
          quoteBalance: bigint
          targetPriceE18: bigint
          valueQuote: bigint
        }
        records.push({
          kind: 'baseline',
          delegationId: args.delegationId,
          characterId: decodeBytes32(args.characterId),
          blockNumber: log.blockNumber,
          quoteAsset: args.quoteAsset,
          pricingDex: args.pricingDex,
          targetAsset: args.targetAsset,
          targetBalance: args.targetBalance,
          quoteBalance: args.quoteBalance,
          targetPriceE18: args.targetPriceE18,
          valueQuote: args.valueQuote,
          ...txRef,
        })
        break
      }
    }
  }
  return records
}
