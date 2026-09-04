import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api'
import { CompiledContract } from '@midnight-ntwrk/compact-js'
import type { ContractAddress, WitnessContext } from '@midnight-ntwrk/compact-runtime'
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts'
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider'
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { setNetworkId, type NetworkId } from '@midnight-ntwrk/midnight-js-network-id'
import {
  Transaction,
  type FinalizedTransaction,
  type TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger'
import type { MidnightProviders, UnboundTransaction } from '@midnight-ntwrk/midnight-js-types'
import {
  fromHex,
  parseCoinPublicKeyToHex,
  parseEncPublicKeyToHex,
  toHex,
} from '@midnight-ntwrk/midnight-js-utils'
import * as CharacterMandate from '../../../../packages/midnight-contract/managed/character-mandate/contract/index.js'
import type {
  DecisionProofInput,
  RelationshipEventInput,
} from '../../../../packages/midnight-contract/src/simulator.js'

import {
  InMemoryPrivateStateProvider,
  PRIVATE_STATE_ID,
  type CharacterRelationshipPrivateState,
} from './privateState.js'

export type CircuitKey =
  | 'openRelationship'
  | 'proveDecision'
  | 'resolvePending'
  | 'recordRelationshipEvent'
  | 'revokeRelationship'

export type CharacterMandateProviders = MidnightProviders<
  CircuitKey,
  typeof PRIVATE_STATE_ID,
  CharacterRelationshipPrivateState
>

export type PublicTransaction = Readonly<{
  txId: string
  blockHeight: number
}>

type CallResult = Readonly<{ public: PublicTransaction }>
type CircuitCalls = Readonly<{
  openRelationship: (...args: unknown[]) => Promise<CallResult>
  proveDecision: (...args: unknown[]) => Promise<CallResult>
  resolvePending: (...args: unknown[]) => Promise<CallResult>
  recordRelationshipEvent: (...args: unknown[]) => Promise<CallResult>
  revokeRelationship: (...args: unknown[]) => Promise<CallResult>
}>

type DecisionState = 'unused' | 'used' | 'pending'

const witnesses: CharacterMandate.Witnesses<CharacterRelationshipPrivateState> = {
  localOwnerSecret: ({ privateState }: WitnessContext<CharacterMandate.Ledger, CharacterRelationshipPrivateState>) => [
    privateState,
    privateState.ownerSecret,
  ],
}

const attachWitnesses = CompiledContract.withWitnesses as (self: unknown, value: unknown) => unknown
const attachAssets = CompiledContract.withCompiledFileAssets as (self: unknown, path: string) => unknown
const contractWithWitnesses = attachWitnesses(
  CompiledContract.make('character-mandate', CharacterMandate.Contract),
  witnesses,
)
const CompiledCharacterMandate = attachAssets(
  contractWithWitnesses,
  './managed/character-mandate',
)

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

const publicTransaction = (result: CallResult): PublicTransaction => ({
  txId: result.public.txId,
  blockHeight: result.public.blockHeight,
})

export function assertLoopbackProofServer(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('로컬 proof server 주소가 올바르지 않습니다.')
  }
  if (
    url.protocol !== 'http:' ||
    (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') ||
    url.port !== '6300' ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('proof server는 http://localhost:6300 또는 http://127.0.0.1:6300만 허용됩니다.')
  }
  return url.toString()
}

export function findCompatibleWallet(
  registry: Record<string, InitialAPI> | undefined =
    typeof window === 'undefined' ? undefined : window.midnight,
): InitialAPI | null {
  return Object.values(registry ?? {}).find((wallet) => /^4\./.test(wallet.apiVersion)) ?? null
}

export async function connectWallet(networkId: NetworkId, timeoutMs = 3_000): Promise<ConnectedAPI> {
  const startedAt = Date.now()
  let wallet = findCompatibleWallet()
  while (!wallet && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    wallet = findCompatibleWallet()
  }
  if (!wallet) throw new Error('DApp Connector API 4.x를 지원하는 Lace 지갑을 찾지 못했습니다.')

  const connected = await wallet.connect(networkId)
  const configuration = await connected.getConfiguration()
  if (configuration.networkId !== networkId) throw new Error('Lace 지갑과 계약의 Midnight network가 다릅니다.')
  return connected
}

export async function createProviders(
  connected: ConnectedAPI,
  networkId: NetworkId,
  origin: string,
  fetchFn: typeof fetch,
  privateStateProvider = new InMemoryPrivateStateProvider(),
): Promise<CharacterMandateProviders> {
  const configuration = await connected.getConfiguration()
  if (configuration.networkId !== networkId) throw new Error('Lace 지갑과 계약의 Midnight network가 다릅니다.')
  if (!configuration.proverServerUri) throw new Error('Lace에 로컬 proof server가 설정되지 않았습니다.')

  setNetworkId(networkId)
  const proofServer = assertLoopbackProofServer(configuration.proverServerUri)
  const zkConfigProvider = new FetchZkConfigProvider<CircuitKey>(origin, fetchFn)
  const addresses = await connected.getShieldedAddresses()
  const coinPublicKey = parseCoinPublicKeyToHex(addresses.shieldedCoinPublicKey, networkId)
  const encryptionPublicKey = parseEncPublicKeyToHex(addresses.shieldedEncryptionPublicKey, networkId)

  return {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(configuration.indexerUri, configuration.indexerWsUri),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proofServer, zkConfigProvider),
    walletProvider: {
      getCoinPublicKey: () => coinPublicKey,
      getEncryptionPublicKey: () => encryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        const balanced = await connected.balanceUnsealedTransaction(toHex(tx.serialize()))
        return Transaction.deserialize(
          'signature',
          'proof',
          'binding',
          fromHex(balanced.tx),
        )
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await connected.submitTransaction(toHex(tx.serialize()))
        const id = tx.identifiers()[0]
        if (!id) throw new Error('제출된 transaction identifier가 없습니다.')
        return id
      },
    },
  }
}

export class CharacterMandateClient {
  private busy = false
  private readonly submittedDecisionIds = new Set<string>()

  constructor(
    readonly address: ContractAddress,
    private readonly calls: CircuitCalls,
    private readonly readDecisionState: (decisionId: Uint8Array) => Promise<DecisionState>,
  ) {}

  open(state: CharacterRelationshipPrivateState): Promise<PublicTransaction> {
    return this.run(async () =>
      publicTransaction(await this.calls.openRelationship(
        state.characterId === 'timid' ? 1n : 2n,
        BigInt(state.targetWeightBps),
        state.characterId === 'timid' ? 300n : 1_000n,
        state.autoThreshold,
        state.budget,
        state.expiry,
        state.commitmentNonce,
        state.relationshipNonce,
      )),
    )
  }

  prove(input: DecisionProofInput): Promise<PublicTransaction> {
    const key = toHex(input.decisionId)
    return this.run(async () => {
      if (this.submittedDecisionIds.has(key) || await this.readDecisionState(input.decisionId) !== 'unused') {
        throw new Error('이 decision은 이미 제출되었거나 owner 결정을 기다리고 있습니다.')
      }
      const result = await this.calls.proveDecision(
        input.decisionId,
        input.characterId,
        input.targetWeightBps,
        input.allowedDriftBps,
        input.autoThreshold,
        input.budget,
        input.expiry,
        input.mandateNonce,
        input.spent,
        input.trustScore,
        input.historyDigest,
        input.relationshipNonce,
        input.currentTimestamp,
        input.valueA,
        input.valueB,
        input.currentWeightA,
        input.currentWeightARemainder,
        input.currentWeightB,
        input.currentWeightBRemainder,
        input.targetValueA,
        input.targetValueARemainder,
        input.targetValueB,
        input.targetValueBRemainder,
        input.effectiveCap,
        input.effectiveCapRemainder,
        input.totalCost,
      )
      this.submittedDecisionIds.add(key)
      return publicTransaction(result)
    })
  }

  resolve(decisionId: Uint8Array, approved: boolean): Promise<PublicTransaction> {
    return this.run(async () => publicTransaction(await this.calls.resolvePending(decisionId, approved)))
  }

  recordEvent(input: RelationshipEventInput): Promise<PublicTransaction> {
    return this.run(async () => publicTransaction(await this.calls.recordRelationshipEvent(
      input.decisionId,
      input.eventKind,
      input.oldSpent,
      input.oldTrustScore,
      input.oldHistoryDigest,
      input.relationshipNonce,
      input.valueQuote,
      input.frictionQuote,
      input.operatingCost,
      input.sourceDigest,
    )))
  }

  revoke(): Promise<PublicTransaction> {
    return this.run(async () => publicTransaction(await this.calls.revokeRelationship()))
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('다른 Midnight 작업이 진행 중입니다.')
    this.busy = true
    try {
      return await operation()
    } finally {
      this.busy = false
    }
  }
}

const clientFrom = (
  found: { deployTxData: { public: { contractAddress: ContractAddress } }; callTx: unknown },
  providers: CharacterMandateProviders,
): CharacterMandateClient => {
  const address = found.deployTxData.public.contractAddress
  providers.privateStateProvider.setContractAddress(address)
  return new CharacterMandateClient(address, found.callTx as CircuitCalls, async (decisionId) => {
    const state = await providers.publicDataProvider.queryContractState(address)
    if (!state) throw new Error('Midnight 계약의 공개 상태를 찾지 못했습니다.')
    const ledger = CharacterMandate.ledger(state.data)
    if (ledger.pendingDecisionId.is_some && sameBytes(ledger.pendingDecisionId.value, decisionId)) return 'pending'
    return sameBytes(ledger.lastReceipt.decisionId, decisionId) ? 'used' : 'unused'
  })
}

export async function deployCharacterMandate(
  providers: CharacterMandateProviders,
  state: CharacterRelationshipPrivateState,
): Promise<CharacterMandateClient> {
  const deploy = deployContract as (...args: any[]) => Promise<any>
  const found = await deploy(providers, {
    compiledContract: CompiledCharacterMandate,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: state,
  })
  return clientFrom(found, providers)
}

export async function joinCharacterMandate(
  providers: CharacterMandateProviders,
  address: ContractAddress,
  state: CharacterRelationshipPrivateState,
): Promise<CharacterMandateClient> {
  const find = findDeployedContract as (...args: any[]) => Promise<any>
  const found = await find(providers, {
    compiledContract: CompiledCharacterMandate,
    contractAddress: address,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: state,
  })
  return clientFrom(found, providers)
}

export function toClientError(error: unknown): Error {
  if (error instanceof Error && /already|이미 제출|진행 중/.test(error.message)) return error
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('proof') || message.includes('fetch')) return new Error('로컬 proof server에 연결하거나 proof를 만들지 못했습니다.')
  if (message.includes('indexer') || message.includes('graphql')) return new Error('Midnight indexer 응답을 확인하지 못했습니다.')
  if (message.includes('assert') || message.includes('circuit')) return new Error('관계 조건이 맞지 않아 circuit 검증이 중단되었습니다.')
  return new Error('Midnight 작업을 완료하지 못했습니다.')
}
