import type { Address } from '@soon/shared'

/**
 * EVM 주소를 비교용으로 정규화한다.
 *
 * 같은 주소가 체크섬 표기(0x5FbD…)와 소문자 표기(0x5fbd…)로 섞여 들어온다 —
 * 라이브러리마다 반환 형식이 다르기 때문이다. 문자열을 그대로 비교하면
 * 같은 자산을 다른 자산으로 취급하게 되고, 그 순간 비중 계산이 통째로 어긋난다.
 */
export function normalizeAddress(a: Address): string {
  return a.toLowerCase()
}

export function sameAddress(a: Address, b: Address): boolean {
  return normalizeAddress(a) === normalizeAddress(b)
}
