import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CharacterStage } from './CharacterStage.js'

describe('CharacterStage', () => {
  it('Live2D 로딩 전에도 대상 canvas를 마운트한다', () => {
    const html = renderToStaticMarkup(createElement(CharacterStage, {
      state: { kind: 'idle' },
      characterId: 'timid',
      characterName: '테스트 캐릭터',
      narration: undefined,
    }))

    expect(html).toContain('id="live2d-canvas"')
    expect(html).toContain('visibility:hidden')
    expect(html).toContain('<svg')
  })
})
