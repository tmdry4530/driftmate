import { characterOf } from '@soon/engine'
import { describe, expect, it } from 'vitest'
import { rebalanceStyleCode, strategyHash } from './delegation.js'

describe('delegation strategy hash', () => {
  it('uses fixed rebalance style codes', () => {
    expect(rebalanceStyleCode('to_target')).toBe(0)
    expect(rebalanceStyleCode('to_band_edge')).toBe(1)
  })

  it('matches the timid ABI hash vector', () => {
    expect(strategyHash(characterOf('timid'))).toBe(
      '0x4acec38fbb39d62ac2bb9c262fcbf617a3cb5235fbd17c73f35b70870ba8ac47',
    )
  })
})
