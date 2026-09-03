/**
 * 위임 설정 입력 검증 (R3.1, R3.2).
 *
 * 컴포넌트에서 떼어내 순수 함수로 둔다 — 화면 안에 묻혀 있으면 검증할 수 없고,
 * 검증하지 않은 입력 규칙은 언젠가 조용히 무너진다.
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

/** 소수점 6자리까지의 달러 표기를 최소단위 정수로. 형식이 어긋나면 undefined. */
export function parseUsd(s: string): bigint | undefined {
  const t = s.trim()
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return undefined
  const [whole, frac = ''] = t.split('.')
  return BigInt(whole!) * 1_000_000n + BigInt(frac.padEnd(6, '0'))
}

/** 소수점 둘째 자리까지의 퍼센트를 basis point로 옮긴다. */
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

/** 서명한 위임 원문과 receipt 블록에서 다시 읽은 값을 정확히 대조한다. */
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
  if (!weightOk) errors.push('비중은 0~100 사이 정수여야 해요.')

  const maxTradeValue = parseUsd(input.maxTrade)
  const autoThreshold = parseUsd(input.autoThreshold)
  const budget = parseUsd(input.budget)
  const operatingCap = parseUsd(input.operatingCap)

  if (maxTradeValue === undefined) errors.push('1회 최대 거래액을 숫자로 적어 주세요.')
  if (autoThreshold === undefined) errors.push('자동 실행 임계값을 숫자로 적어 주세요.')
  if (budget === undefined) errors.push('전체 예산을 숫자로 적어 주세요.')
  if (operatingCap === undefined) errors.push('운영비 한도를 숫자로 적어 주세요.')

  // 자동 실행 임계값이 하드캡보다 크면 의미가 없다 — 넘을 수 없는 선이 하드캡이다.
  if (maxTradeValue !== undefined && autoThreshold !== undefined && autoThreshold > maxTradeValue) {
    errors.push('자동 실행 임계값은 1회 최대 거래액보다 클 수 없어요.')
  }
  // 운영비는 거래와 예산을 공유한다 (R3.7). 별도 예산처럼 크게 잡을 수 없다.
  if (budget !== undefined && operatingCap !== undefined && operatingCap > budget) {
    errors.push('운영비 한도는 전체 예산 안에 있어야 해요.')
  }
  if (budget !== undefined && budget === 0n) errors.push('예산이 0이면 아무것도 할 수 없어요.')

  const days = /^\d+$/.test(input.days.trim()) ? BigInt(input.days.trim()) : 0n
  if (days < 1n || days > BigInt(Number.MAX_SAFE_INTEGER)) errors.push('기간은 1일 이상이어야 해요.')

  const approvalTtlMinutes = /^\d+$/.test(input.approvalTtlMinutes.trim())
    ? BigInt(input.approvalTtlMinutes.trim())
    : 0n
  if (approvalTtlMinutes < 1n) errors.push('승인 요청 유효 시간은 1분 이상이어야 해요.')

  const slippageToleranceBps = parsePercentBps(input.slippagePercent)
  if (slippageToleranceBps === undefined) errors.push('슬리피지는 0~100% 사이, 소수점 둘째 자리까지 적어 주세요.')

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
