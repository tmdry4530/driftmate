import type { Bps } from '@soon/shared'

/** Format a six-decimal quote asset for display. */
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
  if (diff <= 0n) return 'Just now'
  return `${diff} blocks ago`
}
