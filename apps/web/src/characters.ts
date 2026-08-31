import type { CharacterId } from '@soon/shared'
import { CHARACTERS } from '@soon/engine'

/**
 * 캐릭터를 화면에 보여주기 위한 표현.
 *
 * 전략 파라미터 자체는 엔진이 소유하고 여기서는 읽기만 한다. 화면에서 값을 바꿀 수
 * 있으면 캐릭터가 성향의 표현이 아니라 설정 화면 스킨이 된다 (R2.4).
 */
export type CharacterView = Readonly<{
  id: CharacterId
  name: string
  personality: string
  detail: string
  /** 성향을 수치로도 함께 보여준다 (R2.2). */
  bandLabel: string
  styleLabel: string
  minTradeLabel: string
}>

function percent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`
}

function usd(v: bigint): string {
  return `$${(Number(v) / 1e6).toLocaleString('ko-KR')}`
}

export const CHARACTER_VIEWS: readonly CharacterView[] = [
  {
    id: 'timid',
    name: '겁 많은 아이',
    personality: '조금만 틀어져도 바로 고쳐요',
    detail: '자주 손대는 대신 목표 비중에서 멀어지는 일이 드뭅니다. 거래가 잦아 비용도 더 듭니다.',
    bandLabel: `허용 이탈폭 ${percent(CHARACTERS.timid.bandBps as number)}`,
    styleLabel: '목표 비중까지 되돌림',
    minTradeLabel: `최소 거래 ${usd(CHARACTERS.timid.minTradeValue)}`,
  },
  {
    id: 'easygoing',
    name: '느긋한 아이',
    personality: '웬만하면 그냥 둬요',
    detail: '어지간히 벌어지기 전에는 손대지 않습니다. 거래가 드물어 비용은 적지만 비중은 더 흔들립니다.',
    bandLabel: `허용 이탈폭 ${percent(CHARACTERS.easygoing.bandBps as number)}`,
    styleLabel: '밴드 경계까지만 되돌림',
    minTradeLabel: `최소 거래 ${usd(CHARACTERS.easygoing.minTradeValue)}`,
  },
]

export function viewOf(id: CharacterId): CharacterView {
  const found = CHARACTER_VIEWS.find((c) => c.id === id)
  if (!found) throw new Error(`알 수 없는 캐릭터: ${id}`)
  return found
}
