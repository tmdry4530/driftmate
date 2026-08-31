import type { CharacterId } from '@soon/shared'
import { CHARACTER_VIEWS } from '../characters.js'

/**
 * 캐릭터 선택 (R2.1, R2.2, R2.3, R2.5).
 *
 * 성향을 문장과 수치로 함께 보여준다. 파라미터를 고칠 입력란은 두지 않는다 —
 * 화면에서 값을 바꿀 수 있으면 캐릭터가 성향의 표현이 아니라 설정 스킨이 된다 (R2.4).
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
      <h2>누구에게 맡길까요</h2>
      <p className="hint">성향이 곧 운용 방식입니다. 값은 캐릭터가 가지고 있어요.</p>

      <div className="pick">
        {CHARACTER_VIEWS.map((c) => (
          <button
            key={c.id}
            className="pick-item"
            aria-pressed={selected === c.id}
            /* 운용 중에는 바꿀 수 없다. 캐릭터만 갈아치우면 위임은 이전 전략으로
               남아 실행자가 옛 파라미터로 계속 돌게 된다 — 위임을 먼저 끊어야 한다 (R2.5). */
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
          지금은 <strong>{CHARACTER_VIEWS.find((c) => c.id === selected)?.name}</strong>에게 맡겨져 있어요.
          다른 아이로 바꾸려면 먼저 위임을 철회해 주세요.
        </p>
      )}
    </div>
  )
}
