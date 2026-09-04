import { describe, expect, it } from 'vitest'

import { ReceiptStatus, pureCircuits } from '../managed/character-mandate/contract/index.js'
import { CharacterMandateSimulator, type OpenRelationshipInput } from './simulator.js'

const bytes = (value: number): Uint8Array => new Uint8Array(32).fill(value)

const timidMandate = (overrides: Partial<OpenRelationshipInput> = {}): OpenRelationshipInput => ({
  characterId: 1n,
  targetWeightBps: 6_000n,
  allowedDriftBps: 300n,
  autoThreshold: 1_000_000_000n,
  budget: 10_000_000_000n,
  expiry: 2_000_000_000n,
  nonce: bytes(7),
  relationshipNonce: bytes(8),
  ...overrides,
})

describe('CharacterMandate relationship', () => {
  it('stores commitments without public mandate fields', () => {
    const ownerSecret = bytes(3)
    const simulator = new CharacterMandateSimulator(ownerSecret)
    const ledger = simulator.open(timidMandate())

    expect(ledger.active).toBe(true)
    expect(ledger.mandateVersion).toBe(1n)
    expect(ledger.lastReceipt.status).toBe(ReceiptStatus.RELATIONSHIP_OPENED)
    expect(ledger.ownerCommitment).not.toEqual(ownerSecret)
    expect(ledger.mandateCommitment).not.toEqual(timidMandate().nonce)
    expect(Object.keys(ledger)).not.toEqual(
      expect.arrayContaining([
        'characterId',
        'targetWeightBps',
        'allowedDriftBps',
        'autoThreshold',
        'budget',
        'expiry',
      ]),
    )
  })

  it('binds each registered character to its immutable drift strategy', () => {
    expect(() =>
      new CharacterMandateSimulator(bytes(1)).open(timidMandate({ allowedDriftBps: 1_000n })),
    ).toThrow('failed assert: character strategy mismatch')
    expect(() =>
      new CharacterMandateSimulator(bytes(1)).open(timidMandate({ characterId: 3n })),
    ).toThrow('failed assert: unknown character')
  })

  it('requires revoke before opening another relationship', () => {
    const simulator = new CharacterMandateSimulator(bytes(1))
    simulator.open(timidMandate())
    expect(() => simulator.open(timidMandate({ nonce: bytes(8) }))).toThrow(
      'failed assert: relationship already active',
    )
  })

  it('allows only the committed owner to revoke', () => {
    const simulator = new CharacterMandateSimulator(bytes(1))
    simulator.open(timidMandate())
    simulator.switchOwner(bytes(2))
    expect(() => simulator.revoke()).toThrow('failed assert: owner authentication failed')
    simulator.switchOwner(bytes(1))
    const ledger = simulator.revoke()
    expect(ledger.active).toBe(false)
    expect(ledger.lastReceipt.status).toBe(ReceiptStatus.RELATIONSHIP_REVOKED)
  })

  it('domain-separates owner, mandate, and relationship commitments', () => {
    const owner = pureCircuits.computeOwnerCommitment(bytes(1), 1n)
    const mandate = pureCircuits.computeMandateCommitment(
      1n,
      6_000n,
      300n,
      1_000_000_000n,
      10_000_000_000n,
      2_000_000_000n,
      bytes(7),
      1n,
    )
    const relationship = pureCircuits.computeRelationshipCommitment(
      owner,
      mandate,
      0n,
      50n,
      bytes(0),
      bytes(8),
      1n,
    )
    expect(owner).not.toEqual(mandate)
    expect(mandate).not.toEqual(relationship)
  })
})
