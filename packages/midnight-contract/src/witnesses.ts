import type { WitnessContext } from '@midnight-ntwrk/compact-runtime'

import type { Ledger, Witnesses } from '../managed/character-mandate/contract/index.js'

export type CharacterMandatePrivateState = Readonly<{
  ownerSecret: Uint8Array
}>

export const createPrivateState = (ownerSecret: Uint8Array): CharacterMandatePrivateState => ({
  ownerSecret,
})

export const witnesses: Witnesses<CharacterMandatePrivateState> = {
  localOwnerSecret: ({ privateState }: WitnessContext<Ledger, CharacterMandatePrivateState>) => [
    privateState,
    privateState.ownerSecret,
  ],
}
