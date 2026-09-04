import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MidnightApp } from '../../MidnightApp.js'

describe('MidnightApp entry state', () => {
  it('shows the honest private, proven, and public boundary before connection', () => {
    const html = renderToStaticMarkup(createElement(MidnightApp))
    expect(html).toContain('Lace 연결하고 시작')
    expect(html).toContain('PRIVATE · 이 기기에서만 보임')
    expect(html).toContain('PROVEN · circuit이 검증')
    expect(html).toContain('PUBLIC · Midnight ledger')
    expect(html).toContain('공개 receipt가 없습니다.')
  })
})
