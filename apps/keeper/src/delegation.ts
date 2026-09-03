import type { Bytes32, RebalanceStyle, StrategyParams } from '@soon/shared'
import { encodeAbiParameters, keccak256, parseAbiParameters, stringToHex } from 'viem'

const strategyParameters = parseAbiParameters(
  'bytes32 characterId, uint16 bandBps, uint8 rebalanceStyleCode, uint256 minTradeValue',
)

export const SUPPORTED_TRUST_FORMULA_VERSION = 1 as const

export function rebalanceStyleCode(style: RebalanceStyle): number {
  return style === 'to_target' ? 0 : 1
}

export function strategyHash(strategy: StrategyParams): Bytes32 {
  return keccak256(
    encodeAbiParameters(strategyParameters, [
      stringToHex(strategy.characterId, { size: 32 }),
      strategy.bandBps as number,
      rebalanceStyleCode(strategy.rebalanceStyle),
      strategy.minTradeValue,
    ]),
  )
}
