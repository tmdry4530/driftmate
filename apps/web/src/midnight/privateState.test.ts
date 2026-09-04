import { describe, expect, it } from 'vitest'

import {
  InMemoryPrivateStateProvider,
  PRIVATE_STATE_ID,
  createPrivateState,
} from './privateState.js'

const relationship = () =>
  createPrivateState({
    characterId: 'timid',
    targetWeightBps: 6_000,
    autoThreshold: 1_000_000n,
    budget: 10_000_000n,
    expiry: 2_000_000_000n,
  })

describe('in-memory Midnight private state', () => {
  it('is scoped to a contract and disappears with the provider instance', async () => {
    const first = new InMemoryPrivateStateProvider()
    await expect(first.get(PRIVATE_STATE_ID)).rejects.toThrow('계약 주소')
    first.setContractAddress('a'.repeat(64))
    const state = relationship()
    await first.set(PRIVATE_STATE_ID, state)
    expect(await first.get(PRIVATE_STATE_ID)).toBe(state)

    const refreshed = new InMemoryPrivateStateProvider()
    refreshed.setContractAddress('a'.repeat(64))
    expect(await refreshed.get(PRIVATE_STATE_ID)).toBeNull()
  })

  it('does not offer plaintext export or import', async () => {
    const provider = new InMemoryPrivateStateProvider()
    await expect(provider.exportPrivateStates()).rejects.toThrow('비활성화')
    await expect(
      provider.importPrivateStates({
        format: 'midnight-private-state-export',
        encryptedPayload: '',
        salt: '',
      }),
    ).rejects.toThrow('비활성화')
    await expect(provider.exportSigningKeys()).rejects.toThrow('비활성화')
  })

  it('validates mandate bounds before generating secrets', () => {
    expect(() =>
      createPrivateState({
        characterId: 'easygoing',
        targetWeightBps: 500,
        autoThreshold: 1n,
        budget: 1n,
        expiry: 1n,
      }),
    ).toThrow('목표 비중')
  })
})
