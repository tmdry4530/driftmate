import type { Bps } from '@soon/shared'

/**
 * 캐릭터가 지을 수 있는 표정.
 *
 * 손실 구간에서 밝은 표정이 나오면 조롱처럼 읽힌다 (R9.3). 그걸 프롬프트나
 * 설정으로 막으면 언젠가 새어나온다 — 타입으로 갈라 두어 손실 상태에서
 * 밝은 표정을 **고를 수 없게** 만든다.
 */
export type Expression =
  | 'idle'
  | 'thinking'
  | 'asking'
  | 'pleased'
  | 'cheerful'
  | 'concerned'
  | 'apologetic'
  | 'quiet'

/** 손실 구간에서 허용되는 표정. 밝은 계열이 아예 들어 있지 않다. */
export type LosingExpression = Extract<Expression, 'concerned' | 'apologetic' | 'quiet'>

export type AgentState =
  | { kind: 'idle' }
  | { kind: 'deciding' }
  | { kind: 'awaiting_approval' }
  | { kind: 'executed'; pnlBps?: Bps }
  | { kind: 'loss'; pnlBps: Bps; userDisappointed: boolean }

/**
 * 손실 상황의 표정. 반환 타입이 LosingExpression이라
 * 여기에 'cheerful'을 넣으면 컴파일이 깨진다.
 */
function losingExpression(state: Extract<AgentState, { kind: 'loss' }>): LosingExpression {
  if (state.userDisappointed) return 'apologetic'
  return (state.pnlBps as number) < -500 ? 'quiet' : 'concerned'
}

export function expressionFor(state: AgentState): Expression {
  switch (state.kind) {
    case 'idle':
      return 'idle'
    case 'deciding':
      return 'thinking'
    case 'awaiting_approval':
      return 'asking'
    case 'executed':
      // 손익을 모르면 들뜨지 않는다. 이익이어도 과하게 반응하지 않는다.
      if (state.pnlBps === undefined) return 'idle'
      return (state.pnlBps as number) > 0 ? 'pleased' : 'idle'
    case 'loss':
      return losingExpression(state)
  }
}

/** 손실 보고에서는 수치가 캐릭터 반응보다 먼저 온다 (R9.4). */
export type LossReport = Readonly<{
  /** 먼저 보여줄 사실. */
  headline: string
  /** 그 다음에 붙는 캐릭터 반응. */
  reaction: string
}>

export function buildLossReport(pnlBps: Bps, characterName: string): LossReport {
  const pct = (Math.abs(pnlBps as number) / 100).toFixed(2)
  return {
    headline: `${pct}% 줄었어요.`,
    reaction: `${characterName}가 상황을 지켜보고 있어요.`,
  }
}
