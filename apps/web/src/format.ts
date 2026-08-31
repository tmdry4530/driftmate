import type { Bps } from '@soon/shared'

/** quote 자산(6 decimals)을 사람이 읽는 금액으로. */
export function formatQuote(v: bigint): string {
  const whole = v / 1_000_000n
  const frac = (v % 1_000_000n) / 10_000n
  return `$${whole.toLocaleString('ko-KR')}.${frac.toString().padStart(2, '0')}`
}

export function formatBps(v: Bps | number): string {
  return `${(Number(v) / 100).toFixed(2)}%`
}

export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function formatBlockAge(current: bigint, at: bigint): string {
  const diff = current - at
  if (diff <= 0n) return '방금'
  return `${diff}블록 전`
}
