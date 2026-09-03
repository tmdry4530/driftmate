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
  '오를 것',
  '내릴 것',
  '전망',
  '예상 수익',
  '기대 수익',
  '수익률이 예상',
  '추천드립니다',
  '매수하세요',
  '매도하세요',
  '사시는 게',
  '투자하세요',
  '보장',
  '확실히 벌',
]
const FORBIDDEN_BLAMING = ['당신 탓', '잘못 고르', '그러게', '어쩔 수 없었', '제 잘못이 아니']
const FORBIDDEN_WHEN_LOSING = ['축하', '대박', '신나', '최고예요', '기뻐', '만세', '완벽해']
const MONEY_PATTERN = /(?:\$|₩)\s*\d|\d[\d,.]*\s*(?:원|만원|억|달러|불|USD|USDC|ETH|BTC|개|주|코인|토큰)/

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
  const forbidden = [
    ...FORBIDDEN_ALWAYS,
    ...FORBIDDEN_BLAMING,
    ...(isLosing(evidence) ? FORBIDDEN_WHEN_LOSING : []),
  ]
  if (forbidden.some((word) => text.includes(word)) || MONEY_PATTERN.test(text)) return false
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
      return `목표 비중에서 ${drift} 벗어났어요. 제가 참는 범위인 ${band} 안이라 이번엔 그대로 뒀어요.`
    case 'skipped':
      return `${drift} 벌어졌지만 이번엔 손대지 않았어요.`
    case 'asked':
      return `${drift} 벌어져서 되돌리려고 해요. 제 재량을 넘는 금액이라 확인을 받고 진행할게요.`
    case 'executed':
      return `${drift} 벌어져 있길래 목표 비중으로 되돌렸어요.`
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
    `이탈폭: ${evidence.driftBps}bp`,
    `허용 범위: ${evidence.bandBps}bp`,
    ...evidence.weights.map(
      (weight) => `${weight.asset} 현재 ${weight.currentBps}bp / 목표 ${weight.targetBps}bp`,
    ),
    evidence.pnlBps !== undefined ? `손익: ${evidence.pnlBps}bp` : undefined,
    evidence.costBps !== undefined ? `비용: ${evidence.costBps}bp` : undefined,
    `결과: ${evidence.outcome}`,
  ].filter(Boolean)
  return [
    `너는 "${persona.voice}" 말투의 캐릭터다. 아래 사실만 가지고 한두 문장으로 설명해라.`,
    '규칙:',
    '- 아래에 없는 숫자를 절대 쓰지 마라.',
    '- 앞으로의 가격이나 수익을 예측하지 마라.',
    '- 투자를 권유하지 마라.',
    '- 사용자를 탓하지 마라.',
    isLosing(evidence) ? '- 지금은 손실 상황이다. 밝거나 들뜬 표현을 쓰지 마라.' : '',
    '사실:',
    ...facts.map((fact) => `- ${fact}`),
  ].filter(Boolean).join('\n')
}
