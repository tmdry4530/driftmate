import { describe, expect, it } from 'vitest'
import type { Address, Bps, DecisionEvidence, Persona } from '@soon/shared'
import { bps } from '@soon/engine'
import { type LlmClient, narrate, templateNarration, validateNarration } from '@soon/keeper'

const TOKEN = '0x1111111111111111111111111111111111111111' as Address
const USDC = '0x2222222222222222222222222222222222222222' as Address

function evidence(over: Partial<DecisionEvidence> = {}): DecisionEvidence {
  return {
    weights: [
      { asset: TOKEN, currentBps: bps(6_428), targetBps: bps(6_000) },
      { asset: USDC, currentBps: bps(3_571), targetBps: bps(4_000) },
    ],
    driftBps: bps(429),
    bandBps: bps(300),
    outcome: 'executed',
    ...over,
  }
}

const persona: Persona = { characterId: 'timid', voice: '조심스러운', tone: 'soft' }

function llmReturning(text: string): LlmClient {
  return { complete: async () => text }
}

function llmFailing(): LlmClient {
  return {
    complete: async () => {
      throw new Error('LLM 장애')
    },
  }
}

describe('validateNarration — 근거 밖 수치 차단 (R8.5)', () => {
  it('근거에 있는 수치는 통과한다', () => {
    expect(validateNarration('4.29% 벌어져서 되돌렸어요.', evidence())).toBe(true)
    expect(validateNarration('429bp 차이가 났어요.', evidence())).toBe(true)
  })

  it('근거에 없는 수치를 지어내면 폐기한다', () => {
    // 12%는 어디에도 없는 값이다.
    expect(validateNarration('12% 정도 벌어졌어요.', evidence())).toBe(false)
  })

  it('금액을 말하면 폐기한다', () => {
    // 근거에는 금액이 담기지 않으므로 금액 언급은 무조건 지어낸 것이다.
    // 숫자만 대조하면 "3만원"의 3이 밴드 3%의 3과 겹쳐 빠져나간다.
    expect(validateNarration('3만원어치 팔았어요.', evidence())).toBe(false)
    expect(validateNarration('$480 옮겼어요.', evidence())).toBe(false)
    expect(validateNarration('0.2개 팔았어요.', evidence())).toBe(false)
  })

  it('빈 문장은 쓰지 않는다', () => {
    expect(validateNarration('   ', evidence())).toBe(false)
  })
})

describe('validateNarration — 금지 표현 (R8.4, R9.6)', () => {
  it('수익 예측을 거른다', () => {
    expect(validateNarration('앞으로 더 오를 것 같아요.', evidence())).toBe(false)
    expect(validateNarration('수익을 보장할게요.', evidence())).toBe(false)
  })

  it('투자 권유를 거른다', () => {
    expect(validateNarration('지금 매수하세요.', evidence())).toBe(false)
  })

  it('사용자를 탓하는 표현을 거른다', () => {
    expect(validateNarration('그러게 제가 뭐랬어요.', evidence())).toBe(false)
    expect(validateNarration('제 잘못이 아니에요.', evidence())).toBe(false)
  })
})

describe('validateNarration — 손실 상황의 톤 (R9.3)', () => {
  const losing = evidence({ pnlBps: bps(-250) as Bps })

  it('손실 중에는 밝은 표현을 쓰지 않는다', () => {
    expect(validateNarration('축하해요, 정리했어요!', losing)).toBe(false)
    expect(validateNarration('대박이에요!', losing)).toBe(false)
  })

  it('같은 문장도 이익 중에는 허용된다', () => {
    const winning = evidence({ pnlBps: bps(250) as Bps })
    expect(validateNarration('축하해요!', winning)).toBe(true)
    expect(validateNarration('축하해요!', losing)).toBe(false)
  })

  it('손실 사실을 담담히 전하는 문장은 통과한다', () => {
    expect(validateNarration('2.50% 줄었어요. 목표 비중으로 되돌렸어요.', losing)).toBe(true)
  })
})

describe('narrate — 실패해도 흐름을 멈추지 않는다 (R8.3)', () => {
  it('LLM이 죽어도 템플릿으로 대체한다', async () => {
    const n = await narrate(evidence(), persona, llmFailing())
    expect(n.fallback).toBe(true)
    expect(n.text).toContain('4.29%')
  })

  it('검증에 걸린 응답은 버리고 템플릿을 쓴다', async () => {
    const n = await narrate(evidence(), persona, llmReturning('99% 수익이 예상돼요!'))
    expect(n.fallback).toBe(true)
    expect(n.text).toBe(templateNarration(evidence()))
  })

  it('멀쩡한 응답은 그대로 쓴다', async () => {
    const n = await narrate(evidence(), persona, llmReturning('4.29% 벌어져 있길래 되돌렸어요.'))
    expect(n.fallback).toBe(false)
    expect(n.text).toBe('4.29% 벌어져 있길래 되돌렸어요.')
  })

  it('시간이 오래 걸리면 기다리지 않는다', async () => {
    const slow: LlmClient = {
      complete: (_p, signal) =>
        new Promise((_res, rej) => {
          signal.addEventListener('abort', () => rej(new Error('aborted')))
        }),
    }
    const n = await narrate(evidence(), persona, slow, 10)
    expect(n.fallback).toBe(true)
    expect(n.text.length).toBeGreaterThan(0)
  })
})

describe('templateNarration — 결과별 문장', () => {
  it('상황마다 다른 문장을 낸다', () => {
    const held = templateNarration(evidence({ outcome: 'held' }))
    const asked = templateNarration(evidence({ outcome: 'asked' }))
    const executed = templateNarration(evidence({ outcome: 'executed' }))

    expect(held).toContain('그대로 뒀')
    expect(asked).toContain('확인')
    expect(executed).toContain('되돌렸')
  })

  it('템플릿 문장도 자기 검증을 통과한다', () => {
    for (const outcome of ['held', 'asked', 'executed', 'skipped'] as const) {
      const e = evidence({ outcome })
      expect(validateNarration(templateNarration(e), e)).toBe(true)
    }
  })
})
