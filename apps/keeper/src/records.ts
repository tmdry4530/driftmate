import type { Address, DecisionEvidence, DecisionId, TrackRecord } from '@soon/shared'
import { decodeEventLog, hexToString, parseAbi, type PublicClient } from 'viem'
import { normalizeAddress } from '@soon/engine'
import { vaultAbi } from './abi.js'

const VAULT_ABI = parseAbi(vaultAbi)

const REASON_NAMES = [
  'rejected',
  'expired',
  'cost_exceeds_benefit',
  'slippage',
  'stale_price',
  'budget_exhausted',
  'cost_exceeds_benefit', // within_band — 신뢰 계산에는 영향이 없다
  'cost_exceeds_benefit', // below_min_trade
] as const

const COST_KIND_NAMES = ['price_data', 'narration'] as const

/**
 * 온체인 이벤트를 트랙레코드로 되살린다 (R7.2).
 *
 * 신뢰 점수의 유일한 원천이다. DB 사본을 두지 않는 이유는, 사본이 생기면
 * 그것이 진실 원천처럼 굴기 시작하고 "누구나 재현 가능"이라는 주장이 무너지기 때문이다.
 */
/**
 * 온체인 evidence(canonical JSON)를 되살린다.
 * 형식이 어긋나면 조용히 버린다 — 근거가 없으면 캐릭터는 템플릿 문장을 쓴다.
 */
function decodeEvidence(hex: `0x${string}`): DecisionEvidence | undefined {
  try {
    const text = hexToString(hex)
    const raw = JSON.parse(text.replace(/(\d+)n/g, '$1')) as DecisionEvidence
    return typeof raw?.driftBps === 'number' ? raw : undefined
  } catch {
    return undefined
  }
}

export async function loadTrackRecords(
  client: PublicClient,
  vault: Address,
  quoteAsset: Address,
  fromBlock: bigint = 0n,
): Promise<TrackRecord[]> {
  const logs = await client.getLogs({ address: vault, fromBlock, toBlock: 'latest' })
  const parsedRecords: TrackRecord[] = []

  for (const log of logs) {
    let decoded
    try {
      decoded = decodeEventLog({ abi: VAULT_ABI, topics: log.topics as never, data: log.data })
    } catch {
      continue // 우리가 모르는 이벤트는 건너뛴다
    }

    const blockNumber = log.blockNumber ?? 0n
    // 각 기록이 어느 트랜잭션에서 나왔는지 남긴다 — 사용자가 체인에서 직접 확인할 근거다 (R7.5).
    const txRef = log.transactionHash ? { txHash: log.transactionHash } : {}

    switch (decoded.eventName) {
      case 'Executed': {
        const a = decoded.args as {
          decisionId: DecisionId
          tokenIn: Address
          tokenOut: Address
          amountIn: bigint
          amountOut: bigint
          valueQuote: bigint
        }
        // 마찰 = 넣은 가치 - 받은 가치. 받은 쪽이 quote 자산일 때 정확하다.
        // 반대 방향 거래는 그 시점 가격 환산이 필요해 이번 범위에서는 다루지 않는다.
        //
        // 주소는 반드시 정규화해서 비교한다. 이벤트에서 나온 주소는 체크섬 표기이고
        // 설정에서 온 주소는 소문자일 수 있어, 그냥 비교하면 quote 자산을 못 알아보고
        // 슬리피지가 통째로 0으로 잡힌다.
        const outIsQuote = normalizeAddress(a.tokenOut) === normalizeAddress(quoteAsset)
        const friction = outIsQuote && a.valueQuote > a.amountOut ? a.valueQuote - a.amountOut : 0n
        parsedRecords.push({
          kind: 'executed',
          decisionId: a.decisionId,
          blockNumber,
          tokenIn: a.tokenIn,
          tokenOut: a.tokenOut,
          amountIn: a.amountIn,
          amountOut: a.amountOut,
          valueQuote: a.valueQuote,
          frictionQuote: friction,
          ...txRef,
        })
        break
      }
      case 'Decided': {
        const a = decoded.args as {
          decisionId: DecisionId
          characterId: `0x${string}`
          evidence: `0x${string}`
        }
        // evidence는 판단 근거를 canonical 직렬화해 넣은 것이다. 캐릭터의 설명은
        // 이 값에서만 만들어져야 한다 — 화면이 지어낸 수치로 말하면 안 된다.
        const parsed = decodeEvidence(a.evidence)
        if (parsed) {
          parsedRecords.push({
            kind: 'decided',
            decisionId: a.decisionId,
            blockNumber,
            characterId: hexToString(a.characterId, { size: 32 }).replace(/\0+$/, '') as never,
            evidence: parsed,
            ...txRef,
          })
        }
        break
      }
      case 'NotExecuted': {
        const a = decoded.args as { decisionId: DecisionId; reason: number }
        parsedRecords.push({
          kind: 'not_executed',
          decisionId: a.decisionId,
          blockNumber,
          reason: REASON_NAMES[a.reason] ?? 'cost_exceeds_benefit',
          ...txRef,
        })
        break
      }
      case 'CostCharged': {
        const a = decoded.args as { decisionId: DecisionId; amount: bigint; kind: number }
        parsedRecords.push({
          kind: 'cost',
          decisionId: a.decisionId,
          blockNumber,
          amount: a.amount,
          costKind: COST_KIND_NAMES[a.kind] ?? 'price_data',
          ...txRef,
        })
        break
      }
      case 'Disappointed': {
        parsedRecords.push({ kind: 'disappointed', blockNumber, ...txRef })
        break
      }
      default:
        break
    }
  }

  return parsedRecords
}
