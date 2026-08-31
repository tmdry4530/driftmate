import type { CharacterId, StrategyParams } from '@soon/shared'
import { bps } from './brand.js'

/**
 * 캐릭터 = 전략 파라미터 세트 (R2.1).
 * 사용자는 이 값을 수정할 수 없고, 성향을 바꾸려면 캐릭터를 바꿔야 한다 (R2.4).
 */
export const CHARACTERS: Readonly<Record<CharacterId, StrategyParams>> = {
  timid: {
    characterId: 'timid',
    bandBps: bps(300), // 3% — 조금만 틀어져도 바로 고친다
    rebalanceStyle: 'to_target',
    minTradeValue: 1_000_000n,
  },
  easygoing: {
    characterId: 'easygoing',
    bandBps: bps(1_000), // 10% — 웬만하면 그냥 둔다
    rebalanceStyle: 'to_band_edge',
    minTradeValue: 5_000_000n,
  },
} as const

export function characterOf(id: CharacterId): StrategyParams {
  return CHARACTERS[id]
}
