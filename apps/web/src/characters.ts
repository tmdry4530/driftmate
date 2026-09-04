import type { CharacterId } from '@soon/shared'
import { CHARACTERS } from '@soon/engine'

/**
 * Presentation details for each character.
 *
 * The engine owns the strategy parameters; this module only reads them. If the UI
 * could change those values, a character would become a settings skin instead of a strategy (R2.4).
 */
export type CharacterView = Readonly<{
  id: CharacterId
  name: string
  personality: string
  detail: string
  /** Show the strategy numerically as well as through character copy (R2.2). */
  bandLabel: string
  styleLabel: string
  minTradeLabel: string
}>

function percent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`
}

function usd(v: bigint): string {
  return `$${(Number(v) / 1e6).toLocaleString('en-US')}`
}

export const CHARACTER_VIEWS: readonly CharacterView[] = [
  {
    id: 'timid',
    name: 'Cautious',
    personality: 'I rebalance as soon as the portfolio drifts.',
    detail: 'Frequent corrections keep the target close, but increase trading costs.',
    bandLabel: `Allowed drift ${percent(CHARACTERS.timid.bandBps as number)}`,
    styleLabel: 'Return to target',
    minTradeLabel: `Minimum trade ${usd(CHARACTERS.timid.minTradeValue)}`,
  },
  {
    id: 'easygoing',
    name: 'Easygoing',
    personality: 'I wait unless the drift becomes significant.',
    detail: 'Fewer trades reduce costs, but allow wider allocation drift.',
    bandLabel: `Allowed drift ${percent(CHARACTERS.easygoing.bandBps as number)}`,
    styleLabel: 'Return to band edge',
    minTradeLabel: `Minimum trade ${usd(CHARACTERS.easygoing.minTradeValue)}`,
  },
]

export function viewOf(id: CharacterId): CharacterView {
  const found = CHARACTER_VIEWS.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown character: ${id}`)
  return found
}
