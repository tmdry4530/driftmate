/** 브랜드 타입 — 같은 원시 타입이라도 의미가 다르면 섞이지 않게 한다. */
declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

export type Address = `0x${string}`
export type Bytes32 = `0x${string}`
export type DecisionId = Bytes32

/**
 * Basis point. 1bp = 0.01%, 10000bp = 100%.
 * 비율을 소수로 다루면 반올림 방식에 따라 판단이 갈려 결정론(R4.1)이 깨진다.
 * 정수 브랜드로 고정해 부동소수가 비율 계산에 끼어들 수 없게 한다.
 */
export type Bps = Brand<number, 'Bps'>

/** 신뢰 점수 0~100 정수. Bps와 섞이지 않도록 별도 브랜드. */
export type Score = Brand<number, 'Score'>

/** 부호 있는 정수 (점수 증감 등). */
export type Int = Brand<number, 'Int'>

export type CharacterId = 'timid' | 'easygoing'

export type FormulaVersion = `v${number}`
