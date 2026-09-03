import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DecisionEvidence, Persona } from '@soon/shared'
import { bps } from '@soon/engine'
import { FetchLlmClient, narrate } from './narrator.js'

const evidence: DecisionEvidence = {
  weights: [],
  driftBps: bps(429),
  bandBps: bps(300),
  outcome: 'executed',
}
const persona: Persona = { characterId: 'timid', voice: '조심스러운', tone: 'soft' }

afterEach(() => vi.unstubAllGlobals())

describe('Narrator', () => {
  it('native fetch로 OpenAI 호환 응답을 읽고 키를 Authorization 헤더에만 둔다', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: 'Bearer secret' })
      expect(String(init?.body)).not.toContain('secret')
      return new Response(JSON.stringify({ choices: [{ message: { content: '4.29%만큼 되돌렸어요.' } }] }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new FetchLlmClient('https://llm.invalid/chat', 'secret', 'model')
    await expect(narrate(evidence, persona, client)).resolves.toEqual({
      text: '4.29%만큼 되돌렸어요.',
      fallback: false,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('근거 밖 수치나 장애는 템플릿으로 닫는다', async () => {
    const invalid = { complete: async () => '99% 수익을 보장해요.' }
    const failed = { complete: async () => { throw new Error('offline') } }

    expect((await narrate(evidence, persona, invalid)).fallback).toBe(true)
    expect((await narrate(evidence, persona, failed)).fallback).toBe(true)
  })
})
