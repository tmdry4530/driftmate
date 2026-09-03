import type { Bps, Bytes32, KeeperStatus, PendingDecision, TrackRecord } from '@soon/shared'

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

type CurrentStatus = Readonly<{
  delegationId: bigint
  configHash: Bytes32 | undefined
  stateNonce: bigint
  pending: PendingDecision | undefined
  records: readonly TrackRecord[]
}>

function sameHex(a: string | null | undefined, b: string | null | undefined): boolean {
  return a !== undefined && a !== null && b !== undefined && b !== null && a.toLowerCase() === b.toLowerCase()
}

/**
 * Keeper의 표시용 상태를 현재 온체인 세션과 대조한다.
 * owner 승인에 쓰는 pending은 온체인 pending과 decision/nonce/만료가 모두 같아야 한다.
 */
export function currentKeeperStatus(status: KeeperStatus | undefined, current: CurrentStatus): KeeperStatus | undefined {
  if (
    !status ||
    status.delegationId !== String(current.delegationId) ||
    !sameHex(status.configHash, current.configHash)
  ) return undefined

  const pending = status.pending &&
    current.pending?.open &&
    current.pending.proposalNonce + 1n === current.stateNonce &&
    status.pending.delegationId === String(current.pending.delegationId) &&
    status.pending.stateNonce === String(current.stateNonce) &&
    sameHex(status.pending.configHash, current.configHash) &&
    sameHex(status.pending.decisionId, current.pending.decisionId) &&
    status.pending.expiresAt === String(current.pending.expiresAt)
    ? status.pending
    : undefined

  const recorded = new Set<string>()
  for (const record of current.records) {
    if (record.delegationId === current.delegationId && 'decisionId' in record) {
      recorded.add(record.decisionId.toLowerCase())
    }
  }
  const lastDecision = status.lastDecision &&
    status.lastDecision.delegationId === String(current.delegationId) &&
    sameHex(status.lastDecision.configHash, current.configHash) &&
    recorded.has(status.lastDecision.decisionId.toLowerCase())
    ? status.lastDecision
    : undefined
  const lossReport = status.lossReport &&
    status.lossReport.delegationId === String(current.delegationId) &&
    sameHex(status.lossReport.configHash, current.configHash)
    ? status.lossReport
    : undefined
  const snapshot = status.snapshot &&
    status.snapshot.delegationId === String(current.delegationId) &&
    sameHex(status.snapshot.configHash, current.configHash)
    ? status.snapshot
    : undefined
  const narration = status.narration &&
    status.narration.delegationId === String(current.delegationId) &&
    sameHex(status.narration.configHash, current.configHash) &&
    sameHex(status.narration.decisionId, pending?.decisionId ?? lastDecision?.decisionId)
    ? status.narration
    : undefined

  const {
    pending: _pending,
    lastDecision: _lastDecision,
    lossReport: _lossReport,
    snapshot: _snapshot,
    narration: _narration,
    ...base
  } = status
  return {
    ...base,
    phase: status.phase === 'awaiting_approval' && !pending ? 'idle' : status.phase,
    ...(pending ? { pending } : {}),
    ...(lastDecision ? { lastDecision } : {}),
    ...(lossReport ? { lossReport } : {}),
    ...(snapshot ? { snapshot } : {}),
    ...(narration ? { narration } : {}),
  }
}

/** 표정 상태의 우선순위를 한 곳에 고정한다. */
export function deriveAgentState(status: KeeperStatus | undefined, userDisappointed: boolean): AgentState {
  if (status?.phase === 'deciding') return { kind: 'deciding' }
  if (status?.phase === 'awaiting_approval' && status.pending) return { kind: 'awaiting_approval' }
  if (status?.lossReport?.status === 'loss') {
    return { kind: 'loss', pnlBps: status.lossReport.pnlBps, userDisappointed }
  }
  if (status?.lastDecision?.outcome === 'executed') {
    return {
      kind: 'executed',
      ...(status.lossReport?.status === 'not_loss' ? { pnlBps: status.lossReport.pnlBps } : {}),
    }
  }
  return { kind: 'idle' }
}

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
