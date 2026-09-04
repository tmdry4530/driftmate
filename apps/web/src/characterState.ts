import type { Bps, Bytes32, KeeperStatus, PendingDecision, TrackRecord } from '@soon/shared'

/**
 * Expressions available to the character.
 *
 * A cheerful expression during a loss can feel mocking (R9.3). Prompts and
 * configuration can leak, so the type prevents selecting a cheerful expression
 * for a loss state.
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

/** Expressions allowed during a loss; cheerful variants are excluded by type. */
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
 * Reconcile the keeper's display state with the current on-chain session.
 * A pending owner approval must match the on-chain decision, nonce, and expiry.
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

/** Keep expression-state priority in one place. */
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
 * Expression during a loss. The LosingExpression return type rejects 'cheerful'.
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
      // Stay neutral when P&L is unknown and restrained even when it is positive.
      if (state.pnlBps === undefined) return 'idle'
      return (state.pnlBps as number) > 0 ? 'pleased' : 'idle'
    case 'loss':
      return losingExpression(state)
  }
}

/** In a loss report, the number comes before the character reaction (R9.4). */
export type LossReport = Readonly<{
  /** Fact shown first. */
  headline: string
  /** Character reaction shown second. */
  reaction: string
}>

export function buildLossReport(pnlBps: Bps, characterName: string): LossReport {
  const pct = (Math.abs(pnlBps as number) / 100).toFixed(2)
  return {
    headline: `${pct}% down.`,
    reaction: `${characterName} is monitoring the situation.`,
  }
}
