import { describe, expectTypeOf, it } from 'vitest'
import type { Decision, DecisionEvidence, Narration } from '@soon/shared'
import type { VaultWriter } from '@soon/keeper'
import { narrate } from './narrate.js'

type ExecuteArgs = Parameters<VaultWriter['execute']>[0]

describe('LLM 격리 — 설명이 실행을 건드릴 수 없다 (R8.2)', () => {
  it('narrate는 근거만 받는다', () => {
    // Decision 전체가 아니라 읽기 전용 근거만 넘어간다.
    // 거래 내역·총액·판단 ID는 애초에 볼 수 없다.
    expectTypeOf<Parameters<typeof narrate>[0]>().toEqualTypeOf<DecisionEvidence>()
    expectTypeOf<Parameters<typeof narrate>[0]>().not.toEqualTypeOf<Decision>()
  })

  it('narrate는 문자열만 돌려준다', () => {
    expectTypeOf<Awaited<ReturnType<typeof narrate>>>().toEqualTypeOf<Narration>()
    expectTypeOf<Narration>().toEqualTypeOf<Readonly<{ text: string; fallback: boolean }>>()
  })

  it('실행 인자에 Narration이 들어갈 자리가 없다', () => {
    // 실행 경로가 받는 것은 거래·판단ID·근거뿐이다.
    // Narration을 받는 필드가 하나라도 있으면 LLM이 실행에 스며들 통로가 생긴다.
    expectTypeOf<
      Extract<keyof ExecuteArgs, 'narration' | 'text' | 'message' | 'explanation' | 'comment'>
    >().toEqualTypeOf<never>()
  })

  it('Narration을 실행 인자로 넘기면 컴파일이 깨진다', () => {
    const narration: Narration = { text: '되돌렸어요.', fallback: false }

    // @ts-expect-error Narration은 실행 경로에 들어갈 수 없다.
    const bad: ExecuteArgs = narration
    void bad
  })

  it('근거를 실행 인자로 넘겨도 컴파일이 깨진다', () => {
    // 방향이 한쪽이라는 뜻이다 — 근거는 설명으로 흐르고, 되돌아오지 않는다.
    const evidence = {
      weights: [],
      driftBps: 0,
      bandBps: 0,
      outcome: 'executed',
    } as unknown as DecisionEvidence

    // @ts-expect-error 근거 객체는 실행 인자가 아니다.
    const bad: ExecuteArgs = evidence
    void bad
  })
})
