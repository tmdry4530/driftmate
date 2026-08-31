import type { Address, PriceSnapshot } from '@soon/shared'
import { parseAbi, type PublicClient } from 'viem'
import { dexAbi } from './abi.js'

const DEX_ABI = parseAbi(dexAbi)

export class PriceUnavailableError extends Error {
  constructor(cause: unknown) {
    super('가격을 읽지 못했다')
    this.name = 'PriceUnavailableError'
    this.cause = cause
  }
}

/**
 * 실행할 DEX 풀의 스팟을 읽어 불변 스냅샷으로 고정한다 (ADR-0002).
 *
 * 판단 함수는 이 객체를 인자로 받으므로 네트워크를 알 필요가 없다. 같은 스냅샷을
 * 다시 넣으면 언제든 같은 판단이 재현된다 (R4.1).
 */
export async function readSnapshot(
  client: PublicClient,
  params: {
    pool: Address
    quoteAsset: Address
    assets: readonly Address[]
    maxAgeBlocks: bigint
  },
): Promise<PriceSnapshot> {
  try {
    // 블록 번호를 먼저 읽어 가격과 함께 고정한다.
    const blockNumber = await client.getBlockNumber()

    const prices = await Promise.all(
      params.assets.map(async (asset) => {
        // quote 자산은 자기 자신에 대해 1이다.
        if (asset === params.quoteAsset) {
          return { asset, priceE18: 1_000_000_000_000_000_000n }
        }
        const priceE18 = await client.readContract({
          address: params.pool,
          abi: DEX_ABI,
          functionName: 'getSpotPriceE18',
          args: [asset],
          blockNumber,
        })
        return { asset, priceE18 }
      }),
    )

    return {
      blockNumber,
      pool: params.pool,
      quoteAsset: params.quoteAsset,
      prices,
      maxAgeBlocks: params.maxAgeBlocks,
    }
  } catch (cause) {
    // 가격을 못 읽으면 판단하지 않는다. 추정값으로 진행하지 않는 것이 핵심이다 (R4.6).
    throw new PriceUnavailableError(cause)
  }
}

/** 스냅샷이 아직 쓸 수 있는지. 판단 전에 확인한다 (R4.6). */
export function isFresh(snapshot: PriceSnapshot, currentBlock: bigint): boolean {
  return currentBlock - snapshot.blockNumber <= snapshot.maxAgeBlocks
}
