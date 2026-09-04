import type { CharacterId } from '@soon/shared'
import { CHARACTER_VIEWS } from '../characters.js'

/**
 * Character selection (R2.1, R2.2, R2.3, R2.5).
 *
 * Show each strategy in words and numbers. Parameters are not editable here;
 * otherwise the character would become a settings skin (R2.4).
 */
export function CharacterPicker({
  selected,
  onSelect,
  locked,
}: {
  selected: CharacterId | undefined
  onSelect: (id: CharacterId) => void
  locked: boolean
}) {
  return (
    <div className="card">
      <h2>Choose an agent</h2>
      <p className="hint">Each personality has a fixed operating strategy.</p>

      <div className="pick">
        {CHARACTER_VIEWS.map((c) => (
          <button
            key={c.id}
            className="pick-item"
            aria-pressed={selected === c.id}
            /* Character changes require revocation so an active delegation cannot
               continue with stale strategy parameters (R2.5). */
            disabled={locked && selected !== c.id}
            onClick={() => onSelect(c.id)}
          >
            <div className="name">{c.name}</div>
            <div className="say">“{c.personality}”</div>
            <div className="nums">
              <span className="tag">{c.bandLabel}</span>
              <span className="tag">{c.styleLabel}</span>
              <span className="tag">{c.minTradeLabel}</span>
            </div>
          </button>
        ))}
      </div>

      {locked && selected && (
        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
          <strong>{CHARACTER_VIEWS.find((c) => c.id === selected)?.name}</strong> currently manages this delegation.
          Revoke it before switching agents.
        </p>
      )}
    </div>
  )
}
