import { CompiledContract } from '@midnight-ntwrk/compact-js'

import * as CharacterMandateContract from '../managed/character-mandate/contract/index.js'
import { witnesses } from './witnesses.js'

export * as CharacterMandate from '../managed/character-mandate/contract/index.js'
export { CharacterMandateSimulator } from './simulator.js'
export { createPrivateState, witnesses } from './witnesses.js'
export type { DecisionProofInput, OpenRelationshipInput, RelationshipEventInput } from './simulator.js'
export type { CharacterMandatePrivateState } from './witnesses.js'

export const CompiledCharacterMandate = CompiledContract.make(
  'character-mandate',
  CharacterMandateContract.Contract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('./managed/character-mandate'),
)
