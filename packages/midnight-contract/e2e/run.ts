import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'

import { CompiledContract } from '@midnight-ntwrk/compact-js'
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts'
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider'
import {
  SucceedEntirely,
  type FinalizedTxData,
  type MidnightProviders,
  type PrivateStateId,
} from '@midnight-ntwrk/midnight-js-types'
import {
  getContainersConfiguration,
  getTestEnvironment,
  inMemoryPrivateStateProvider,
  setContainersConfiguration,
} from '@midnight-ntwrk/testkit-js'
import pino from 'pino'
import { WebSocket } from 'ws'

import * as CharacterMandate from '../managed/character-mandate/contract/index.js'
import { createPrivateState, type CharacterMandatePrivateState, witnesses } from '../src/witnesses.js'

type CircuitKey = keyof CharacterMandate.ProvableCircuits<CharacterMandatePrivateState>

const PRIVATE_STATE_ID: PrivateStateId = 'character-mandate'
const bytes = (value: number): Uint8Array => new Uint8Array(32).fill(value)
const ownerSecret = bytes(0xa7)
const mandateNonce = bytes(0xb8)
const relationshipNonce = bytes(0xc9)
const initialHistoryDigest = bytes(0)
const threshold = 999_999_937n
const budget = 100_000_000_019n
const expiry = 2_100_000_127n

const privateTextMarkers = [
  ownerSecret,
  mandateNonce,
  relationshipNonce,
].map((value) => Buffer.from(value).toString('hex'))

const u64 = (value: bigint, littleEndian: boolean): Buffer => {
  const result = Buffer.alloc(8)
  if (littleEndian) result.writeBigUInt64LE(value)
  else result.writeBigUInt64BE(value)
  return result
}

const privateBinaryMarkers: Uint8Array[] = [
  ownerSecret,
  mandateNonce,
  relationshipNonce,
].map((value) => Buffer.from(value))
for (const value of [threshold, budget, expiry]) {
  privateBinaryMarkers.push(u64(value, true), u64(value, false))
}

const assertNoPrivateText = (value: string): void => {
  const normalized = value.toLowerCase()
  for (const marker of privateTextMarkers) {
    assert.equal(normalized.includes(marker), false, 'private fixture appeared in text output')
  }
}

const assertNoPrivateBytes = (tx: FinalizedTxData['tx']): void => {
  const serialized = Buffer.from(tx.serialize())
  for (const marker of privateBinaryMarkers) {
    assert.equal(serialized.indexOf(Buffer.from(marker)), -1, 'private fixture appeared in transaction output')
  }
}

const assertFinalized = (tx: FinalizedTxData): void => {
  assert.equal(tx.status, SucceedEntirely)
  assert.ok(tx.txId.length > 0)
  assert.ok(tx.blockHeight >= 0)
  assertNoPrivateBytes(tx.tx)
}

const expectContractRejection = async (
  run: () => Promise<unknown>,
  expectedMessage: string,
): Promise<void> => {
  try {
    await run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    assertNoPrivateText(message)
    assert.ok(message.includes(expectedMessage), 'contract rejected for an unexpected reason')
    return
  }
  throw new Error('contract unexpectedly accepted an invalid call')
}

const divmod = (dividend: bigint, divisor: bigint): readonly [bigint, bigint] => [
  dividend / divisor,
  dividend % divisor,
]

const proofArguments = (decisionId: Uint8Array, characterId = 1n, allowedDriftBps = 300n) => {
  const valueA = 7_200_000_000n
  const valueB = 4_000_000_000n
  const total = valueA + valueB
  const [currentWeightA, currentWeightARemainder] = divmod(valueA * 10_000n, total)
  const [currentWeightB, currentWeightBRemainder] = divmod(valueB * 10_000n, total)
  const [targetValueA, targetValueARemainder] = divmod(total * 6_000n, 10_000n)
  const [targetValueB, targetValueBRemainder] = divmod(total * 4_000n, 10_000n)
  const [effectiveCap, effectiveCapRemainder] = divmod(threshold * 5_500n, 10_000n)

  return [
    decisionId,
    characterId,
    6_000n,
    allowedDriftBps,
    threshold,
    budget,
    expiry,
    mandateNonce,
    0n,
    50n,
    initialHistoryDigest,
    relationshipNonce,
    1_900_000_000n,
    valueA,
    valueB,
    currentWeightA,
    currentWeightARemainder,
    currentWeightB,
    currentWeightBRemainder,
    targetValueA,
    targetValueARemainder,
    targetValueB,
    targetValueBRemainder,
    effectiveCap,
    effectiveCapRemainder,
    2_500_000n,
  ] as const
}

const publicLedger = async (
  providers: MidnightProviders<CircuitKey, PrivateStateId, CharacterMandatePrivateState>,
  contractAddress: string,
): Promise<CharacterMandate.Ledger> => {
  const state = await providers.publicDataProvider.queryContractState(contractAddress)
  assert.ok(state, 'indexer did not return the deployed contract state')
  return CharacterMandate.ledger(state.data)
}

let stage = 'preflight'

const run = async (): Promise<void> => {
  const rootDir = path.resolve(import.meta.dirname, '../../..')
  const infrastructureDir = path.join(rootDir, 'infra/midnight')
  const managedDir = path.join(rootDir, 'packages/midnight-contract/managed/character-mandate')
  const containers = getContainersConfiguration()
  setContainersConfiguration({
    ...containers,
    standalone: { ...containers.standalone, path: infrastructureDir, fileName: 'compose.yml' },
  })

  Object.assign(globalThis, { WebSocket })
  const logger = pino({ level: 'silent' })
  const testEnvironment = getTestEnvironment(logger)
  let started = false

  try {
    stage = 'local devnet startup'
    const environment = await testEnvironment.start()
    started = true
    assert.match(environment.proofServer, /^http:\/\/127\.0\.0\.1:\d+$/)
    assert.match(environment.indexer, /^http:\/\/127\.0\.0\.1:\d+\/api\/v4\/graphql$/)

    stage = 'wallet sync'
    const wallet = await testEnvironment.getMidnightWalletProvider()
    const zkConfigProvider = new NodeZkConfigProvider<CircuitKey>(managedDir)
    const providers: MidnightProviders<CircuitKey, PrivateStateId, CharacterMandatePrivateState> = {
      privateStateProvider: inMemoryPrivateStateProvider<PrivateStateId, CharacterMandatePrivateState>(),
      publicDataProvider: indexerPublicDataProvider(environment.indexer, environment.indexerWS),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(environment.proofServer, zkConfigProvider),
      walletProvider: wallet,
      midnightProvider: wallet,
    }
    const compiledContract = CompiledContract.make<
      CharacterMandate.Contract<CharacterMandatePrivateState>
    >('character-mandate', CharacterMandate.Contract).pipe(
      CompiledContract.withWitnesses(witnesses),
      CompiledContract.withCompiledFileAssets(managedDir),
    )

    stage = 'contract deployment'
    const deployed = await deployContract(providers, {
      compiledContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: createPrivateState(ownerSecret),
    })
    assertFinalized(deployed.deployTxData.public)
    const contractAddress = deployed.deployTxData.public.contractAddress

    stage = 'relationship proof'
    const opened = await deployed.callTx.openRelationship(
      1n,
      6_000n,
      300n,
      threshold,
      budget,
      expiry,
      mandateNonce,
      relationshipNonce,
    )
    assertFinalized(opened.public)

    const afterOpen = await publicLedger(providers, contractAddress)
    assert.deepEqual(Object.keys(afterOpen).sort(), [
      'active',
      'lastReceipt',
      'mandateCommitment',
      'mandateVersion',
      'ownerCommitment',
      'pendingDecisionId',
      'receiptSequence',
      'relationshipCommitment',
      'usedDecisionIds',
    ])
    assert.equal(afterOpen.lastReceipt.status, CharacterMandate.ReceiptStatus.RELATIONSHIP_OPENED)
    assert.notDeepEqual(afterOpen.ownerCommitment, ownerSecret)
    assert.notDeepEqual(afterOpen.mandateCommitment, mandateNonce)

    stage = 'mandate substitution rejection'
    const invalidDecisionId = bytes(0xeb)
    await expectContractRejection(
      () => deployed.callTx.proveDecision(...proofArguments(invalidDecisionId, 2n, 1_000n)),
      'mandate commitment mismatch',
    )
    assert.equal((await publicLedger(providers, contractAddress)).receiptSequence, 1n)

    stage = 'decision proof'
    const decisionId = bytes(0xfc)
    const proved = await deployed.callTx.proveDecision(...proofArguments(decisionId))
    assertFinalized(proved.public)

    const afterProof = await publicLedger(providers, contractAddress)
    assert.equal(afterProof.lastReceipt.status, CharacterMandate.ReceiptStatus.PROVED_AUTO_ELIGIBLE)
    assert.deepEqual(afterProof.lastReceipt.decisionId, decisionId)
    assert.equal(afterProof.receiptSequence, 2n)

    stage = 'replay rejection'
    await expectContractRejection(
      () => deployed.callTx.proveDecision(...proofArguments(decisionId)),
      'decision already used',
    )
    assert.equal((await publicLedger(providers, contractAddress)).receiptSequence, 2n)

    process.stdout.write('midnight:e2e ok: local-devnet proofs=2 finalized=3 privacy=pass\n')
  } finally {
    if (started) await testEnvironment.shutdown()
  }
}

await run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  let redacted = message
  for (const marker of privateTextMarkers) redacted = redacted.replaceAll(marker, '[redacted]')
  process.stderr.write(`midnight:e2e failed at ${stage}: ${redacted}\n`)
  process.exitCode = 1
})
