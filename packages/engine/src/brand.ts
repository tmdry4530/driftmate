import type { Bps, Int, Score } from '@soon/shared'

/**
 * 브랜드 타입 생성자.
 * 비율·점수가 정수라는 전제는 결정론의 일부이므로 경계에서 강제한다 —
 * 소수가 섞이면 반올림 방식에 따라 같은 입력이 다른 판단을 낼 수 있다.
 */
export function bps(n: number): Bps {
  if (!Number.isInteger(n)) {
    throw new RangeError(`Bps must be an integer, got ${n}`)
  }
  return n as Bps
}

export function score(n: number): Score {
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    throw new RangeError(`Score must be an integer in [0, 100], got ${n}`)
  }
  return n as Score
}

export function int(n: number): Int {
  if (!Number.isInteger(n)) {
    throw new RangeError(`Int must be an integer, got ${n}`)
  }
  return n as Int
}
