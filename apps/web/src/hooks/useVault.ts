import { useCallback, useEffect, useState } from 'react'
import { parseAbi } from 'viem'
import { usePublicClient } from 'wagmi'
import type { Address, TrackRecord } from '@soon/shared'
import { loadTrackRecords, vaultAbi } from '@soon/keeper'
import type { AppConfig } from '../config.js'

const VAULT = parseAbi(vaultAbi)

export type VaultState = {
  active: boolean
  autoThreshold: bigint | undefined
  budget: bigint | undefined
  budgetSpent: bigint | undefined
  records: readonly TrackRecord[]
  blockNumber: bigint
}

const EMPTY: VaultState = {
  active: false,
  autoThreshold: undefined,
  budget: undefined,
  budgetSpent: undefined,
  records: [],
  blockNumber: 0n,
}

/** 볼트 상태와 트랙레코드를 읽는다. 원천은 언제나 체인이다 (R7.2). */
export function useVault(config: AppConfig, pollMs = 6_000) {
  const client = usePublicClient()
  const [state, setState] = useState<VaultState>(EMPTY)
  const [error, setError] = useState<string | undefined>()

  const refresh = useCallback(async () => {
    if (!client) return
    try {
      const [active, spent, delegation, blockNumber] = await Promise.all([
        client.readContract({ address: config.vault, abi: VAULT, functionName: 'isActive' }),
        client.readContract({ address: config.vault, abi: VAULT, functionName: 'budgetSpent' }),
        client.readContract({ address: config.vault, abi: VAULT, functionName: 'delegation' }),
        client.getBlockNumber(),
      ])
      const records = await loadTrackRecords(client as never, config.vault, config.quote)
      setState({
        active,
        autoThreshold: delegation.autoThreshold,
        budget: delegation.budget,
        budgetSpent: spent,
        records,
        blockNumber,
      })
      setError(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : '볼트를 읽지 못했어요')
    }
  }, [client, config.vault, config.quote])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(t)
  }, [refresh, pollMs])

  return { state, error, refresh }
}

export const vaultAbiParsed = VAULT
export type { Address }
