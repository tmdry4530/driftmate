/** 1bp = 0.01%, 10000bp = 100%. */
export const BPS_DENOMINATOR = 10_000

/** 가격의 고정소수 스케일. 금액은 전부 bigint이고 부동소수를 쓰지 않는다. */
export const PRICE_SCALE = 1_000_000_000_000_000_000n // 1e18
