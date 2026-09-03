import { useCallback, useEffect, useState } from 'react'
import type {
  Address,
  Bps,
  Bytes32,
  DecisionEvidence,
  KeeperStatus,
  LossReport,
  NarrationView,
  PendingView,
} from '@soon/shared'

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('잘못된 status 응답')
  return value as Record<string, unknown>
}

function decimal(value: unknown): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('잘못된 정수')
  return value
}

function signedDecimal(value: unknown): string {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) throw new Error('잘못된 부호 정수')
  return value
}

function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error('잘못된 정수')
  return value
}

function hex(value: unknown, bytes: number): Bytes32 {
  if (typeof value !== 'string' || !new RegExp('^0x[0-9a-fA-F]{' + bytes * 2 + '}$').test(value)) {
    throw new Error('잘못된 hex 값')
  }
  return value as Bytes32
}

function address(value: unknown): Address {
  return hex(value, 20) as Address
}

function reviveEvidence(value: unknown): DecisionEvidence {
  const evidence = object(value)
  if (!Array.isArray(evidence.weights)) throw new Error('잘못된 판단 근거')
  if (!['executed', 'held', 'asked', 'skipped'].includes(String(evidence.outcome))) {
    throw new Error('잘못된 판단 결과')
  }
  return {
    weights: evidence.weights.map((value) => {
      const weight = object(value)
      return {
        asset: address(weight.asset),
        currentBps: integer(weight.currentBps) as Bps,
        targetBps: integer(weight.targetBps) as Bps,
      }
    }),
    driftBps: integer(evidence.driftBps) as Bps,
    bandBps: integer(evidence.bandBps) as Bps,
    outcome: evidence.outcome as DecisionEvidence['outcome'],
    ...(evidence.pnlBps === undefined ? {} : { pnlBps: integer(evidence.pnlBps) as Bps }),
    ...(evidence.costBps === undefined ? {} : { costBps: integer(evidence.costBps) as Bps }),
  }
}

function revivePending(value: unknown): PendingView {
  const p = object(value)
  const trade = object(p.trade)
  if (p.capSource !== 'user' && p.capSource !== 'trust') throw new Error('잘못된 한도 근거')
  return {
    delegationId: decimal(p.delegationId),
    configHash: hex(p.configHash, 32),
    stateNonce: decimal(p.stateNonce),
    decisionId: hex(p.decisionId, 32),
    dex: address(p.dex),
    trade: {
      tokenIn: address(trade.tokenIn),
      tokenOut: address(trade.tokenOut),
      amountIn: BigInt(decimal(trade.amountIn)),
      minAmountOut: BigInt(decimal(trade.minAmountOut)),
    },
    evidence: reviveEvidence(p.evidence),
    expiresAt: decimal(p.expiresAt),
    effectiveCap: decimal(p.effectiveCap),
    overBy: decimal(p.overBy),
    capSource: p.capSource,
  }
}

function reviveLossReport(value: unknown): LossReport {
  const report = object(value)
  if (report.status !== 'loss' && report.status !== 'not_loss' && report.status !== 'cashflow_unknown') {
    throw new Error('잘못된 손익 상태')
  }
  return {
    delegationId: decimal(report.delegationId),
    configHash: hex(report.configHash, 32),
    reportId: hex(report.reportId, 32),
    baselineBlock: decimal(report.baselineBlock),
    currentBlock: decimal(report.currentBlock),
    baselineValueQuote: decimal(report.baselineValueQuote),
    currentValueQuote: decimal(report.currentValueQuote),
    operatingSpent: decimal(report.operatingSpent),
    pnlQuote: signedDecimal(report.pnlQuote),
    pnlBps: integer(report.pnlBps) as Bps,
    priceSource: address(report.priceSource),
    status: report.status,
  }
}

function reviveNarration(value: unknown): NarrationView {
  const narration = object(value)
  if (typeof narration.text !== 'string' || typeof narration.fallback !== 'boolean') {
    throw new Error('잘못된 설명')
  }
  return {
    delegationId: decimal(narration.delegationId),
    configHash: hex(narration.configHash, 32),
    decisionId: hex(narration.decisionId, 32),
    text: narration.text,
    fallback: narration.fallback,
  }
}

/** Keeper JSON을 owner 트랜잭션에 쓰기 전에 엄격히 복원한다. */
export function parseKeeperStatus(value: unknown): KeeperStatus {
  const raw = object(value)
  if (raw.phase !== 'idle' && raw.phase !== 'deciding' && raw.phase !== 'awaiting_approval') {
    throw new Error('잘못된 Keeper phase')
  }
  const delegationId = raw.delegationId === null ? null : decimal(raw.delegationId)
  const configHash = raw.configHash === null ? null : hex(raw.configHash, 32)
  const lastDecision = raw.lastDecision === undefined ? undefined : object(raw.lastDecision)
  const snapshot = raw.snapshot === undefined ? undefined : object(raw.snapshot)
  if (lastDecision && !['executed', 'held', 'skipped'].includes(String(lastDecision.outcome))) {
    throw new Error('잘못된 마지막 판단')
  }
  if (raw.lastError !== undefined && typeof raw.lastError !== 'string') throw new Error('잘못된 오류 메시지')
  return {
    phase: raw.phase,
    delegationId,
    configHash,
    ...(raw.pending === undefined ? {} : { pending: revivePending(raw.pending) }),
    ...(lastDecision === undefined ? {} : { lastDecision: {
      delegationId: decimal(lastDecision.delegationId),
      configHash: hex(lastDecision.configHash, 32),
      decisionId: hex(lastDecision.decisionId, 32),
      outcome: lastDecision.outcome as 'executed' | 'held' | 'skipped',
    } }),
    ...(snapshot === undefined ? {} : { snapshot: {
      delegationId: decimal(snapshot.delegationId),
      configHash: hex(snapshot.configHash, 32),
      blockNumber: decimal(snapshot.blockNumber),
      targetBalance: decimal(snapshot.targetBalance),
      quoteBalance: decimal(snapshot.quoteBalance),
      targetPriceE18: decimal(snapshot.targetPriceE18),
      valueQuote: decimal(snapshot.valueQuote),
    } }),
    ...(raw.narration === undefined ? {} : { narration: reviveNarration(raw.narration) }),
    ...(raw.lossReport === undefined ? {} : { lossReport: reviveLossReport(raw.lossReport) }),
    ...(raw.lastError === undefined ? {} : { lastError: raw.lastError }),
  }
}

export function useKeeperApi(baseUrl: string | undefined, pollMs = 5_000) {
  const [status, setStatus] = useState<KeeperStatus | undefined>()
  const [online, setOnline] = useState(false)

  const refresh = useCallback(async () => {
    if (!baseUrl) {
      setOnline(false)
      return
    }
    try {
      const res = await fetch(`${baseUrl}/status`)
      if (!res.ok) throw new Error('Keeper HTTP ' + res.status)
      setStatus(parseKeeperStatus(await res.json()))
      setOnline(true)
    } catch {
      setOnline(false)
    }
  }, [baseUrl])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(timer)
  }, [refresh, pollMs])

  return { status, online, refresh }
}
