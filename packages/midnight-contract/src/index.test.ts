import { CompiledContract } from '@midnight-ntwrk/compact-js'
import { expect, it } from 'vitest'

import { CompiledCharacterMandate } from './index.js'

it('wires witnesses and managed proof assets into the compiled contract', () => {
  expect(CompiledContract.getCompiledAssetsPath(CompiledCharacterMandate)).toBe(
    './managed/character-mandate',
  )
})
