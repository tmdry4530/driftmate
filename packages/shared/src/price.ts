import type { Address } from './primitives.js'

export type AssetPrice = Readonly<{
  asset: Address
  /**
   * asset 1 최소단위당 quoteAsset 최소단위 가격, 1e18 고정소수.
   * 최소단위 기준으로 정의해 decimals 보정을 계산에서 없앤다.
   */
  priceE18: bigint
}>

/**
 * 판단 함수 바깥에서 확정되는 불변 가격 스냅샷.
 * 이 객체를 입력으로 받기 때문에 판단 함수가 네트워크와 시계를 몰라도 된다 (R4.1, R4.5).
 */
export type PriceSnapshot = Readonly<{
  blockNumber: bigint
  pool: Address
  quoteAsset: Address
  prices: readonly AssetPrice[]
  /** 이 블록 수를 넘겨 오래되면 판단하지 않는다 (R4.6). */
  maxAgeBlocks: bigint
}>
