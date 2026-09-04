import type { ContractAddress, SigningKey } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime'
import type {
  ExportPrivateStatesOptions,
  ExportSigningKeysOptions,
  ImportPrivateStatesOptions,
  ImportPrivateStatesResult,
  ImportSigningKeysOptions,
  ImportSigningKeysResult,
  PrivateStateExport,
  PrivateStateProvider,
  SigningKeyExport,
} from '@midnight-ntwrk/midnight-js-types'
import type { CharacterId } from '@soon/shared'

export const PRIVATE_STATE_ID = 'characterRelationship' as const

export type CharacterRelationshipPrivateState = Readonly<{
  ownerSecret: Uint8Array
  commitmentNonce: Uint8Array
  relationshipNonce: Uint8Array
  characterId: CharacterId
  targetWeightBps: number
  autoThreshold: bigint
  budget: bigint
  expiry: bigint
  spent: bigint
  trustScore: number
  historyDigest: Uint8Array
  contributionDigests: readonly `0x${string}`[]
}>

export type NewRelationship = Readonly<{
  characterId: CharacterId
  targetWeightBps: number
  autoThreshold: bigint
  budget: bigint
  expiry: bigint
}>

const MAX_VALUE = 800_000_000_000_000n

const randomBytes = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32))

const isNonZero = (value: Uint8Array): boolean => value.some((byte) => byte !== 0)

export function createPrivateState(input: NewRelationship): CharacterRelationshipPrivateState {
  const band = input.characterId === 'timid' ? 300 : 1_000
  if (!Number.isInteger(input.targetWeightBps) || input.targetWeightBps <= band || input.targetWeightBps + band >= 10_000) {
    throw new RangeError('목표 비중이 캐릭터 허용 범위를 벗어났습니다.')
  }
  if (input.autoThreshold <= 0n || input.autoThreshold > input.budget || input.budget > MAX_VALUE) {
    throw new RangeError('위임 한도 또는 예산이 허용 범위를 벗어났습니다.')
  }
  if (input.expiry <= 0n) throw new RangeError('만료 시각이 올바르지 않습니다.')

  const ownerSecret = randomBytes()
  const commitmentNonce = randomBytes()
  const relationshipNonce = randomBytes()
  if (!isNonZero(ownerSecret) || !isNonZero(commitmentNonce) || !isNonZero(relationshipNonce)) {
    throw new Error('안전한 관계 비밀값을 만들지 못했습니다.')
  }
  if (
    commitmentNonce.every((byte, index) => byte === relationshipNonce[index])
  ) {
    throw new Error('관계 nonce가 중복되었습니다.')
  }

  return {
    ...input,
    ownerSecret,
    commitmentNonce,
    relationshipNonce,
    spent: 0n,
    trustScore: 50,
    historyDigest: new Uint8Array(32),
    contributionDigests: [],
  }
}

export class InMemoryPrivateStateProvider
  implements PrivateStateProvider<typeof PRIVATE_STATE_ID, CharacterRelationshipPrivateState>
{
  private contractAddress: ContractAddress | undefined
  private readonly states = new Map<ContractAddress, Map<typeof PRIVATE_STATE_ID, CharacterRelationshipPrivateState>>()
  private readonly signingKeys = new Map<ContractAddress, SigningKey>()

  setContractAddress(address: ContractAddress): void {
    this.contractAddress = address
  }

  async set(id: typeof PRIVATE_STATE_ID, state: CharacterRelationshipPrivateState): Promise<void> {
    const address = this.requireContractAddress()
    const scoped = this.states.get(address) ?? new Map()
    scoped.set(id, state)
    this.states.set(address, scoped)
  }

  async get(id: typeof PRIVATE_STATE_ID): Promise<CharacterRelationshipPrivateState | null> {
    return this.states.get(this.requireContractAddress())?.get(id) ?? null
  }

  async remove(id: typeof PRIVATE_STATE_ID): Promise<void> {
    this.states.get(this.requireContractAddress())?.delete(id)
  }

  async clear(): Promise<void> {
    this.states.delete(this.requireContractAddress())
  }

  async setSigningKey(address: ContractAddress, signingKey: SigningKey): Promise<void> {
    this.signingKeys.set(address, signingKey)
  }

  async getSigningKey(address: ContractAddress): Promise<SigningKey | null> {
    return this.signingKeys.get(address) ?? null
  }

  async removeSigningKey(address: ContractAddress): Promise<void> {
    this.signingKeys.delete(address)
  }

  async clearSigningKeys(): Promise<void> {
    this.signingKeys.clear()
  }

  async exportPrivateStates(_options?: ExportPrivateStatesOptions): Promise<PrivateStateExport> {
    throw new Error('비공개 상태 export는 이 데모에서 비활성화되어 있습니다.')
  }

  async importPrivateStates(
    _data: PrivateStateExport,
    _options?: ImportPrivateStatesOptions,
  ): Promise<ImportPrivateStatesResult> {
    throw new Error('비공개 상태 import는 이 데모에서 비활성화되어 있습니다.')
  }

  async exportSigningKeys(_options?: ExportSigningKeysOptions): Promise<SigningKeyExport> {
    throw new Error('서명키 export는 이 데모에서 비활성화되어 있습니다.')
  }

  async importSigningKeys(
    _data: SigningKeyExport,
    _options?: ImportSigningKeysOptions,
  ): Promise<ImportSigningKeysResult> {
    throw new Error('서명키 import는 이 데모에서 비활성화되어 있습니다.')
  }

  private requireContractAddress(): ContractAddress {
    if (!this.contractAddress) throw new Error('계약 주소가 설정되지 않았습니다.')
    return this.contractAddress
  }
}
