import { describe, expectTypeOf, it } from 'vitest'
import type { Expression, LosingExpression } from './characterState.js'

describe('표정 타입 — 손실 구간 제약 (R9.3)', () => {
  it('손실 표정에 밝은 계열이 없다', () => {
    // 설정이 아니라 타입으로 갈라둔다. 여기에 밝은 표정을 넣으려면
    // 타입 정의 자체를 고쳐야 하고, 그건 리뷰에서 반드시 보인다.
    expectTypeOf<LosingExpression>().toEqualTypeOf<'concerned' | 'apologetic' | 'quiet'>()
    expectTypeOf<Extract<LosingExpression, 'cheerful' | 'pleased'>>().toEqualTypeOf<never>()
  })

  it('밝은 표정은 손실 표정으로 대입되지 않는다', () => {
    // @ts-expect-error 손실 구간에서 고를 수 없는 표정이다.
    const bad: LosingExpression = 'cheerful'
    void bad
  })

  it('손실 표정은 전체 표정의 부분집합이다', () => {
    expectTypeOf<LosingExpression>().toMatchTypeOf<Expression>()
  })
})
