import { useCallback, useEffect, useState } from 'react'
import { hexToString, parseAbi } from 'viem'
import { usePublicClient } from 'wagmi'
import type { Address, Bps, Bytes32, CharacterId, PendingDecision, TrackRecord } from '@soon/shared'
import { bps } from '@soon/engine'
import { loadTrackRecords, vaultAbi } from '@soon/keeper'
import type { AppConfig } from '../config.js'

const VAULT = parseAbi(vaultAbi)

export type VaultState = {
  active: boolean
  delegationId: bigint
  configHash: Bytes32 | undefined
  stateNonce: bigint
  delegation: Readonly<{
    executor: Address
    characterId: CharacterId | undefined
    strategyHash: Bytes32
    trustFormulaVersion: number
    quoteAsset: Address
    maxTradeValue: bigint
    autoThreshold: bigint
    budget: bigint
    operatingCap: bigint
    expiry: bigint
    approvalTtlSeconds: bigint
    slippageToleranceBps: Bps
    targetAsset: Address
    targetAssetBps: Bps
    allowedAssets: readonly Address[]
    allowedDexes: readonly Address[]
  }> | undefined
  budgetSpent: bigint | undefined
  operatingSpent: bigint | undefined
  pending: PendingDecision | undefined
  records: readonly TrackRecord[]
  blockNumber: bigint
  blockTimestamp: bigint
}

const EMPTY: VaultState = {
  active: false,
  delegationId: 0n,
  configHash: undefined,
  stateNonce: 0n,
  delegation: undefined,
  budgetSpent: undefined,
  operatingSpent: undefined,
  pending: undefined,
  records: [],
  blockNumber: 0n,
  blockTimestamp: 0n,
}

function decodeCharacter(value: Bytes32): CharacterId | undefined {
  const id = hexToString(value, { size: 32 }).replace(/\0+$/, '')
  return id === 'timid' || id === 'easygoing' ? id : undefined
}

/** 볼트 상태와 트랙레코드를 읽는다. 원천은 언제나 체인이다 (R7.2). */
export function useVault(config: AppConfig, pollMs = 6_000) {
  const client = usePublicClient()
  const [state, setState] = useState<VaultState>(EMPTY)
  const [error, setError] = useState<string | undefined>()

  const refresh = useCallback(async () => {
    if (!client) return
    try {
      const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
      const [active, spent, operatingSpent, delegationId, configHash, stateNonce, delegation, pending, block] = await Promise.all([
        client.readContract({ address: config.vault, abi: VAULT, functionName: 'isActive', blockNumber }),
        client.readContract({ address: config.vault, abi: VAULT, functionName: 'budgetSpent', blockNumber }),
        client.readContract({ address: config.vault, abi: VAULT, functionName: 'operatingSpent', blockNumber }),
        client.readContract({ address: config.vault, abi: VAULT, functionName: 'delegationId', blockNumber }),
        client.readContract({ address: config.vault, abi: VAULT, functionName: 'configHash', blockNumber }),
        client.readContract({ address: config.vault, abi: VAULT, functionName: 'stateNonce', blockNumber }),
        client.readContract({ address: config.vault, abi: VAULT, functionName: 'delegation', blockNumber }),
        client.readContract({ address: config.vault, abi: VAULT, functionName: 'pendingDecision', blockNumber }),
        client.getBlock({ blockNumber }),
      ])
      const records = await loadTrackRecords(client as never, config.vault, 0n, blockNumber)
      setState({
        active,
        delegationId,
        configHash,
        stateNonce,
        delegation: delegationId === 0n ? undefined : {
          ...delegation,
          characterId: decodeCharacter(delegation.characterId),
          slippageToleranceBps: bps(delegation.slippageToleranceBps),
          targetAssetBps: bps(delegation.targetAssetBps),
          allowedAssets: [...delegation.allowedAssets],
          allowedDexes: [...delegation.allowedDexes],
        },
        budgetSpent: spent,
        operatingSpent,
        pending: pending.open ? { ...pending } : undefined,
        records,
        blockNumber,
        blockTimestamp: block.timestamp,
      })
      setError(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : '볼트를 읽지 못했어요')
    }
  }, [client, config.vault])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(t)
  }, [refresh, pollMs])

  return { state, error, refresh }
}

export const vaultAbiParsed = VAULT
export type { Address }
