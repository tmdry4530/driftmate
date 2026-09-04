import type { DecisionEvidence, Narration, Persona } from '@soon/shared'

export interface LlmClient {
  complete(prompt: string, signal: AbortSignal): Promise<string>
}

export class FetchLlmClient implements LlmClient {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async complete(prompt: string, signal: AbortSignal): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      }),
      signal,
    })
    if (!response.ok) throw new Error(`LLM HTTP ${response.status}`)
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const text = body.choices?.[0]?.message?.content
    if (!text) throw new Error('LLM response has no text')
    return text
  }
}

const FORBIDDEN_ALWAYS = [
  'will rise',
  'will fall',
  'price outlook',
  'expected return',
  'recommend buying',
  'recommend selling',
  'buy now',
  'sell now',
  'should buy',
  'should sell',
  'invest in',
  'guarantee',
  'sure profit',
]
const FORBIDDEN_BLAMING = ['your fault', 'you chose poorly', 'i told you so', 'not my fault']
const FORBIDDEN_WHEN_LOSING = ['congratulations', 'amazing', 'exciting', 'perfect', 'celebrate']
const MONEY_PATTERN = /\$\s*\d|\d[\d,.]*\s*(?:dollars?|USD|USDC|ETH|BTC|coins?|tokens?|shares?|units?)/i

function extractNumbers(text: string): number[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter(Number.isFinite)
}

function allowedNumbers(evidence: DecisionEvidence): Set<number> {
  const result = new Set<number>()
  const add = (value: number | undefined) => {
    if (value === undefined) return
    const absolute = Math.abs(value)
    const percent = absolute / 100
    result.add(absolute)
    result.add(percent)
    result.add(Number(percent.toFixed(1)))
    result.add(Number(percent.toFixed(2)))
    result.add(Math.round(percent))
  }
  add(evidence.driftBps as number)
  add(evidence.bandBps as number)
  add(evidence.pnlBps as number | undefined)
  add(evidence.costBps as number | undefined)
  for (const weight of evidence.weights) {
    add(weight.currentBps as number)
    add(weight.targetBps as number)
  }
  return result
}

function isLosing(evidence: DecisionEvidence): boolean {
  return evidence.pnlBps !== undefined && (evidence.pnlBps as number) < 0
}

export function validateNarration(text: string, evidence: DecisionEvidence): boolean {
  if (text.trim().length === 0) return false
  const normalized = text.toLowerCase()
  const forbidden = [
    ...FORBIDDEN_ALWAYS,
    ...FORBIDDEN_BLAMING,
    ...(isLosing(evidence) ? FORBIDDEN_WHEN_LOSING : []),
  ]
  if (forbidden.some((word) => normalized.includes(word)) || MONEY_PATTERN.test(text)) return false
  const allowed = allowedNumbers(evidence)
  return extractNumbers(text).every((number) => allowed.has(number))
}

function percent(value: number): string {
  return `${(Math.abs(value) / 100).toFixed(2)}%`
}

export function templateNarration(evidence: DecisionEvidence): string {
  const drift = percent(evidence.driftBps as number)
  const band = percent(evidence.bandBps as number)
  switch (evidence.outcome) {
    case 'held':
      return `The allocation is ${drift} away from target, within my ${band} tolerance, so I left it unchanged.`
    case 'skipped':
      return `The allocation drifted ${drift}, but no trade was executed this time.`
    case 'asked':
      return `The allocation drifted ${drift}. Rebalancing exceeds my discretion, so I am asking for your approval.`
    case 'executed':
      return `The allocation drifted ${drift}, so I rebalanced it toward the target.`
  }
}

export async function narrate(
  evidence: DecisionEvidence,
  persona: Persona,
  llm: LlmClient,
  timeoutMs = 4_000,
): Promise<Narration> {
  const fallback = templateNarration(evidence)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const text = (await llm.complete(buildPrompt(evidence, persona), controller.signal)).trim()
    return validateNarration(text, evidence)
      ? { text, fallback: false }
      : { text: fallback, fallback: true }
  } catch {
    return { text: fallback, fallback: true }
  } finally {
    clearTimeout(timer)
  }
}

function buildPrompt(evidence: DecisionEvidence, persona: Persona): string {
  const facts = [
    `Drift: ${evidence.driftBps}bp`,
    `Allowed band: ${evidence.bandBps}bp`,
    ...evidence.weights.map(
      (weight) => `${weight.asset} current ${weight.currentBps}bp / target ${weight.targetBps}bp`,
    ),
    evidence.pnlBps !== undefined ? `P&L: ${evidence.pnlBps}bp` : undefined,
    evidence.costBps !== undefined ? `Cost: ${evidence.costBps}bp` : undefined,
    `Outcome: ${evidence.outcome}`,
  ].filter(Boolean)
  return [
    `You are a character with a "${persona.voice}" voice. Explain only the facts below in one or two sentences.`,
    'Rules:',
    '- Never use a number that is not listed below.',
    '- Do not predict future prices or returns.',
    '- Do not recommend an investment.',
    '- Do not blame the user.',
    isLosing(evidence) ? '- This is a loss. Do not sound cheerful or celebratory.' : '',
    'Facts:',
    ...facts.map((fact) => `- ${fact}`),
  ].filter(Boolean).join('\n')
}
