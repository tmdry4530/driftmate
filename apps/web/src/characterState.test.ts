import { describe, expect, it } from 'vitest'
import { bps } from '@soon/engine'
import { buildLossReport, expressionFor } from './characterState.js'

describe('expressionFor — 손실 구간의 톤 (R9.2, R9.3)', () => {
  it('손실 중에는 밝은 표정이 나오지 않는다', () => {
    const small = expressionFor({ kind: 'loss', pnlBps: bps(-100), userDisappointed: false })
    const big = expressionFor({ kind: 'loss', pnlBps: bps(-900), userDisappointed: false })

    expect(['concerned', 'quiet']).toContain(small)
    expect(['concerned', 'quiet']).toContain(big)
    expect(small).not.toBe('cheerful')
    expect(big).not.toBe('pleased')
  })

  it('실망을 표시하면 사과하는 표정으로 바뀐다 (R9.7)', () => {
    const e = expressionFor({ kind: 'loss', pnlBps: bps(-100), userDisappointed: true })
    expect(e).toBe('apologetic')
  })

  it('상태마다 표정이 갈린다 (R9.2)', () => {
    expect(expressionFor({ kind: 'idle' })).toBe('idle')
    expect(expressionFor({ kind: 'deciding' })).toBe('thinking')
    expect(expressionFor({ kind: 'awaiting_approval' })).toBe('asking')
    expect(expressionFor({ kind: 'executed', pnlBps: bps(300) })).toBe('pleased')
  })

  it('이익이 없는 실행에는 들뜨지 않는다', () => {
    expect(expressionFor({ kind: 'executed', pnlBps: bps(0) })).toBe('idle')
  })
})

describe('buildLossReport — 수치가 먼저 (R9.4)', () => {
  it('손실 수치를 먼저 제시하고 반응을 뒤에 붙인다', () => {
    const r = buildLossReport(bps(-250), '겁 많은 아이')
    expect(r.headline).toBe('2.50% 줄었어요.')
    expect(r.reaction).toContain('겁 많은 아이')
  })

  it('머리말에 회피 표현이 없다', () => {
    const r = buildLossReport(bps(-250), '느긋한 아이')
    for (const w of ['하지만', '그래도', '괜찮', '어쩔 수 없']) {
      expect(r.headline).not.toContain(w)
    }
  })
})
