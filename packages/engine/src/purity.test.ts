import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ENGINE_PACKAGE } from './index.js'

describe('엔진 패키지 제약', () => {
  it('패키지가 로드된다', () => {
    expect(ENGINE_PACKAGE).toBe('@soon/engine')
  })

  // 결정론(R4.1·R4.5)은 규율이 아니라 구조로 지킨다.
  // 런타임 의존성이 0이면 네트워크·시계 라이브러리가 들어올 통로가 없다.
  it('런타임 의존성이 없다', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { dependencies?: Record<string, string> }
    expect(pkg.dependencies ?? {}).toEqual({})
  })
})
