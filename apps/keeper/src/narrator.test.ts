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
const persona: Persona = { characterId: 'timid', voice: 'careful', tone: 'soft' }

afterEach(() => vi.unstubAllGlobals())

describe('Narrator', () => {
  it('native fetch로 OpenAI 호환 응답을 읽고 키를 Authorization 헤더에만 둔다', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: 'Bearer secret' })
      expect(String(init?.body)).not.toContain('secret')
      return new Response(JSON.stringify({ choices: [{ message: { content: 'I rebalanced the 4.29% drift.' } }] }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new FetchLlmClient('https://llm.invalid/chat', 'secret', 'model')
    await expect(narrate(evidence, persona, client)).resolves.toEqual({
      text: 'I rebalanced the 4.29% drift.',
      fallback: false,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('근거 밖 수치나 장애는 템플릿으로 닫는다', async () => {
    const invalid = { complete: async () => 'I guarantee a 99% return.' }
    const failed = { complete: async () => { throw new Error('offline') } }

    expect((await narrate(evidence, persona, invalid)).fallback).toBe(true)
    expect((await narrate(evidence, persona, failed)).fallback).toBe(true)
  })
})
