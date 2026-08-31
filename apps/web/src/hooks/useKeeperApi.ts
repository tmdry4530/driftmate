import { useCallback, useEffect, useState } from 'react'
import type { Decision, DecisionId } from '@soon/shared'

/** 실행자 API의 응답. bigint는 문자열로 넘어온다. */
type RawPending = {
  decision: Omit<Decision, 'totalValue'> & { totalValue: string }
  dex: string
  createdAtBlock: string
  expiresAtBlock: string
}

export type PendingView = {
  decision: Decision
  dex: `0x${string}`
  createdAtBlock: bigint
  expiresAtBlock: bigint
}

function revive(p: RawPending): PendingView {
  return {
    decision: { ...p.decision, totalValue: BigInt(p.decision.totalValue) } as Decision,
    dex: p.dex as `0x${string}`,
    createdAtBlock: BigInt(p.createdAtBlock),
    expiresAtBlock: BigInt(p.expiresAtBlock),
  }
}

export function useKeeperApi(baseUrl: string | undefined, pollMs = 5_000) {
  const [pending, setPending] = useState<PendingView[]>([])
  const [online, setOnline] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!baseUrl) return
    try {
      const res = await fetch(`${baseUrl}/pending`)
      const body = (await res.json()) as { pending: RawPending[] }
      setPending(body.pending.map(revive))
      setOnline(true)
    } catch {
      // 실행자가 꺼져 있어도 화면의 나머지는 그대로 쓴다.
      setOnline(false)
    }
  }, [baseUrl])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(t)
  }, [refresh, pollMs])

  const act = useCallback(
    async (path: 'approve' | 'reject', id: DecisionId) => {
      if (!baseUrl) return
      setBusy(true)
      try {
        await fetch(`${baseUrl}/${path}?id=${id}`, { method: 'POST' })
        await refresh()
      } finally {
        setBusy(false)
      }
    },
    [baseUrl, refresh],
  )

  return { pending, online, busy, refresh, approve: (id: DecisionId) => act('approve', id), reject: (id: DecisionId) => act('reject', id) }
}
