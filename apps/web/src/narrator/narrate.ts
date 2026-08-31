import type { DecisionEvidence, Narration, Persona } from '@soon/shared'

export interface LlmClient {
  complete(prompt: string, signal: AbortSignal): Promise<string>
}

/** 수익 예측·투자 권유로 읽힐 수 있는 표현 (R8.4). */
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

/** 사용자의 판단이나 손실을 평가·비난하는 표현 (R9.6, R9.7). */
const FORBIDDEN_BLAMING = ['당신 탓', '잘못 고르', '그러게', '어쩔 수 없었', '제 잘못이 아니']

/** 손실 구간에서 금지되는 밝은 표현 (R9.3). */
const FORBIDDEN_WHEN_LOSING = ['축하', '대박', '신나', '최고예요', '기뻐', '만세', '완벽해']

/**
 * 금액 표현.
 *
 * DecisionEvidence에는 금액이 아예 담기지 않는다(설계상 Narrator는 거래 규모를 모른다).
 * 따라서 문장에 금액이 등장했다면 그 값은 근거에서 나올 수 없는 것 —— 지어낸 것이다.
 * 숫자만 대조하면 "3만원"의 3이 "밴드 3%"의 3과 구분되지 않아 빠져나간다.
 */
const MONEY_PATTERN = /(?:\$|₩)\s*\d|\d[\d,.]*\s*(?:원|만원|억|달러|불|USD|USDC|ETH|BTC|개|주|코인|토큰)/

/**
 * 문장에 등장하는 수를 뽑는다.
 * 근거에 없는 수를 지어냈는지 검사하는 데 쓴다 (R8.5).
 */
function extractNumbers(text: string): number[] {
  const found = text.match(/\d+(?:\.\d+)?/g) ?? []
  return found.map(Number).filter((n) => Number.isFinite(n))
}

/**
 * 근거에서 유도될 수 있는 수의 집합.
 * bps 원값과 퍼센트 표기, 그리고 흔한 반올림까지 허용한다.
 */
function allowedNumbers(e: DecisionEvidence): Set<number> {
  const out = new Set<number>()
  const push = (bpsValue: number | undefined) => {
    if (bpsValue === undefined) return
    const v = Math.abs(bpsValue)
    out.add(v)
    const pct = v / 100
    out.add(pct)
    out.add(Number(pct.toFixed(1)))
    out.add(Number(pct.toFixed(2)))
    out.add(Math.round(pct))
  }

  push(e.driftBps as number)
  push(e.bandBps as number)
  push(e.pnlBps as number | undefined)
  push(e.costBps as number | undefined)
  for (const w of e.weights) {
    push(w.currentBps as number)
    push(w.targetBps as number)
  }
  return out
}

function isLosing(e: DecisionEvidence): boolean {
  return e.pnlBps !== undefined && (e.pnlBps as number) < 0
}

/** 생성된 문장이 쓸 수 있는지 판정한다. 하나라도 걸리면 폐기한다. */
export function validateNarration(text: string, e: DecisionEvidence): boolean {
  if (text.trim().length === 0) return false

  const banned = [...FORBIDDEN_ALWAYS, ...FORBIDDEN_BLAMING, ...(isLosing(e) ? FORBIDDEN_WHEN_LOSING : [])]
  if (banned.some((w) => text.includes(w))) return false

  // 금액은 근거에 존재하지 않는다. 언급 자체가 지어낸 것이다.
  if (MONEY_PATTERN.test(text)) return false

  // 근거에 없는 수치를 지어내면 버린다 (R8.5).
  const allowed = allowedNumbers(e)
  return extractNumbers(text).every((n) => allowed.has(n))
}

function pct(bpsValue: number): string {
  return `${(Math.abs(bpsValue) / 100).toFixed(2)}%`
}

/**
 * 근거만으로 만드는 문장. LLM이 실패하거나 검증에 걸리면 이걸 쓴다 (R8.3).
 * 캐릭터 말투는 약해지지만 사실은 정확하고, 흐름은 멈추지 않는다.
 */
export function templateNarration(e: DecisionEvidence): string {
  const drift = pct(e.driftBps as number)
  const band = pct(e.bandBps as number)

  switch (e.outcome) {
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

/**
 * 판단 근거를 캐릭터 말투로 옮긴다 (R8.1).
 *
 * 받는 것은 읽기 전용 근거뿐이고 돌려주는 것은 문자열뿐이다. 거래 내역도, 볼트 주소도,
 * 실행 여부를 바꿀 수단도 이 함수에는 없다 (R8.2).
 */
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
    const text = await llm.complete(buildPrompt(evidence, persona), controller.signal)
    const trimmed = text.trim()
    if (!validateNarration(trimmed, evidence)) {
      return { text: fallback, fallback: true }
    }
    return { text: trimmed, fallback: false }
  } catch {
    // 설명이 실패해도 판단과 실행은 이미 끝난 일이다. 흐름을 멈추지 않는다 (R8.3).
    return { text: fallback, fallback: true }
  } finally {
    clearTimeout(timer)
  }
}

function buildPrompt(e: DecisionEvidence, persona: Persona): string {
  const facts = [
    `이탈폭: ${e.driftBps}bp`,
    `허용 범위: ${e.bandBps}bp`,
    ...e.weights.map((w) => `${w.asset} 현재 ${w.currentBps}bp / 목표 ${w.targetBps}bp`),
    e.pnlBps !== undefined ? `손익: ${e.pnlBps}bp` : undefined,
    e.costBps !== undefined ? `비용: ${e.costBps}bp` : undefined,
    `결과: ${e.outcome}`,
  ].filter(Boolean)

  return [
    `너는 "${persona.voice}" 말투의 캐릭터다. 아래 사실만 가지고 한두 문장으로 설명해라.`,
    '',
    '규칙:',
    '- 아래에 없는 숫자를 절대 쓰지 마라.',
    '- 앞으로의 가격이나 수익을 예측하지 마라.',
    '- 투자를 권유하지 마라.',
    '- 사용자를 탓하지 마라.',
    isLosing(e) ? '- 지금은 손실 상황이다. 밝거나 들뜬 표현을 쓰지 마라.' : '',
    '',
    '사실:',
    ...facts.map((f) => `- ${f}`),
  ]
    .filter(Boolean)
    .join('\n')
}
