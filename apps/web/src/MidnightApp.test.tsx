import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MidnightApp } from './MidnightApp.js'

describe('MidnightApp', () => {
  it('starts fail-honestly with the character and privacy boundary visible', () => {
    const html = renderToStaticMarkup(createElement(MidnightApp))
    expect(html).toContain('AI 캐릭터와의 약속은 숨기고')
    expect(html).toContain('Lace 연결하고 시작')
    expect(html).toContain('PRIVATE · 이 기기에서만 보임')
    expect(html).toContain('PROVEN · circuit이 검증')
    expect(html).toContain('PUBLIC · Midnight ledger')
    expect(html).toContain('공개 receipt가 없습니다.')
    expect(html).not.toContain('proof 완료')
  })
})
