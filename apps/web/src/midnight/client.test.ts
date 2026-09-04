import { describe, expect, it, vi } from 'vitest'

import { CharacterMandateClient, assertLoopbackProofServer, findCompatibleWallet } from './client.js'

const result = { public: { txId: 'tx-1', blockHeight: 42 } }
const calls = () => ({
  openRelationship: vi.fn(async () => result),
  proveDecision: vi.fn(async () => result),
  resolvePending: vi.fn(async () => result),
  recordRelationshipEvent: vi.fn(async () => result),
  revokeRelationship: vi.fn(async () => result),
})

const proof = {
  decisionId: new Uint8Array(32).fill(7),
  characterId: 1n,
  targetWeightBps: 6_000n,
  allowedDriftBps: 300n,
  autoThreshold: 1n,
  budget: 2n,
  expiry: 3n,
  mandateNonce: new Uint8Array(32),
  spent: 0n,
  trustScore: 50n,
  historyDigest: new Uint8Array(32),
  relationshipNonce: new Uint8Array(32),
  currentTimestamp: 1n,
  valueA: 1n,
  valueB: 1n,
  currentWeightA: 5_000n,
  currentWeightARemainder: 0n,
  currentWeightB: 5_000n,
  currentWeightBRemainder: 0n,
  targetValueA: 1n,
  targetValueARemainder: 0n,
  targetValueB: 1n,
  targetValueBRemainder: 0n,
  effectiveCap: 1n,
  effectiveCapRemainder: 0n,
  totalCost: 0n,
} as const

describe('Midnight browser client guards', () => {
  it('accepts only the explicit loopback proof server', () => {
    expect(assertLoopbackProofServer('http://localhost:6300')).toBe('http://localhost:6300/')
    expect(assertLoopbackProofServer('http://127.0.0.1:6300')).toBe('http://127.0.0.1:6300/')
    for (const url of [
      'https://localhost:6300',
      'http://localhost:6301',
      'http://10.0.0.2:6300',
      'http://localhost:6300/proofs',
      'http://localhost:6300?target=remote',
    ]) {
      expect(() => assertLoopbackProofServer(url)).toThrow('6300')
    }
  })

  it('selects only DApp Connector API major 4', () => {
    const compatible = { apiVersion: '4.0.1' }
    expect(findCompatibleWallet({ old: { apiVersion: '3.9.0' }, lace: compatible } as never)).toBe(compatible)
    expect(findCompatibleWallet({ old: { apiVersion: '3.9.0' } } as never)).toBeNull()
  })

  it('serializes circuit calls and blocks duplicate decisions', async () => {
    let release: (() => void) | undefined
    const pendingCalls = calls()
    pendingCalls.proveDecision.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve(result)
    }))
    const client = new CharacterMandateClient('a'.repeat(64), pendingCalls, async () => 'unused')
    const first = client.prove(proof)
    await expect(client.revoke()).rejects.toThrow('진행 중')
    release?.()
    await expect(first).resolves.toEqual(result.public)
    await expect(client.prove(proof)).rejects.toThrow('이미 제출')
    expect(pendingCalls.proveDecision).toHaveBeenCalledTimes(1)
  })

  it('rechecks public pending state before proof submission', async () => {
    const contractCalls = calls()
    const client = new CharacterMandateClient('a'.repeat(64), contractCalls, async () => 'pending')
    await expect(client.prove(proof)).rejects.toThrow('owner 결정을')
    expect(contractCalls.proveDecision).not.toHaveBeenCalled()
  })
})
