import type {
  Address,
  Bps,
  CharacterId,
  DecisionEvidence,
  DecisionId,
  Holding,
  KeeperStatus,
  Narration,
  PendingDecision,
  PendingView,
  Persona,
  PortfolioBaseline,
  PriceSnapshot,
  SkipReason,
  TrackRecord,
} from '@soon/shared'
import {
  BPS_DENOMINATOR,
  PRICE_SCALE,
  canonical,
  characterOf,
  computePnl,
  computeTrust,
  decide,
  resolveGate,
  sameAddress,
} from '@soon/engine'
import { NOT_EXECUTED_REASON } from './abi.js'
import { strategyHash, SUPPORTED_TRUST_FORMULA_VERSION } from './delegation.js'
import { narrate, templateNarration, type LlmClient } from './narrator.js'
import { BudgetExhaustedError, CostMeter } from './payment.js'
import type { ChainReader, OnChainDelegation, VaultWriter } from './ports.js'
import { isFresh } from './priceSource.js'

export type TickResult =
  | { kind: 'inactive'; reason: 'revoked' | 'expired' | 'unsupported_delegation' | 'cashflow_unknown' }
  | { kind: 'skipped'; reason: SkipReason | 'budget_exhausted' | 'expired'; decisionId?: DecisionId }
  | { kind: 'executed'; decisionId: DecisionId; txHash: `0x${string}`; value: bigint }
  | { kind: 'asked'; decisionId: DecisionId; overBy: bigint; effectiveCap: bigint }
  | { kind: 'awaiting_approval'; decisionId: DecisionId; expiresAt: bigint }
  | { kind: 'rejected'; decisionId: DecisionId; reason: string }

export type KeeperConfig = Readonly<{
  vault: Address
  maxAgeBlocks: bigint
  gasValueEstimate: bigint
}>

function utf8ToHex(s: string): `0x${string}` {
  const bytes = new TextEncoder().encode(s)
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return `0x${out}`
}

function encodeEvidence(evidence: DecisionEvidence): `0x${string}` {
  return utf8ToHex(canonical(evidence))
}

function characterId(value: string): CharacterId | undefined {
  return value === 'timid' || value === 'easygoing' ? value : undefined
}

function skipReasonCode(reason: SkipReason): number {
  return NOT_EXECUTED_REASON[reason]
}

function gateReasonCode(reason: string): number {
  if (reason === 'expired') return NOT_EXECUTED_REASON.expired
  if (reason === 'budget_exhausted') return NOT_EXECUTED_REASON.budget_exhausted
  return NOT_EXECUTED_REASON.rejected
}

function remaining(limit: bigint, spent: bigint): bigint {
  return spent >= limit ? 0n : limit - spent
}

const PERSONAS: Readonly<Record<CharacterId, Persona>> = {
  timid: { characterId: 'timid', voice: '조심스럽고 책임감 있는', tone: 'soft' },
  easygoing: { characterId: 'easygoing', voice: '느긋하고 담담한', tone: 'calm' },
}

export class Keeper {
  private lastSnapshot: PriceSnapshot | undefined
  private inFlight: Promise<TickResult> | undefined
  private readonly narrationCache = new Map<string, Readonly<{
    narration: Narration
    outcome: DecisionEvidence['outcome']
  }>>()
  private statusValue: KeeperStatus = { phase: 'idle', delegationId: null, configHash: null }

  constructor(
    private readonly reader: ChainReader,
    private readonly writer: VaultWriter,
    private readonly meter: CostMeter,
    private readonly config: KeeperConfig,
    private readonly loadRecords: (toBlock?: bigint) => Promise<readonly TrackRecord[]>,
    private readonly llm?: LlmClient,
  ) {}

  status(): KeeperStatus {
    return this.statusValue
  }

  async refreshStatus(): Promise<KeeperStatus> {
    if (this.inFlight) return this.statusValue
    try {
      const blockNumber = await this.reader.getBlockNumber()
      const [delegation, baseline, pending] = await Promise.all([
        this.reader.readDelegation(this.config.vault, blockNumber),
        this.reader.readPortfolioBaseline(this.config.vault, blockNumber),
        this.reader.readPendingDecision(this.config.vault, blockNumber),
      ])
      const identity = {
        delegationId: delegation.delegationId === 0n ? null : String(delegation.delegationId),
        configHash: delegation.configHash,
      } as const
      if (delegation.expiry === 0n) {
        this.statusValue = { phase: 'idle', ...identity }
        return this.statusValue
      }
      const id = this.validateDelegation(delegation, baseline)
      if (!id || baseline.characterId !== id) {
        this.statusValue = { phase: 'idle', ...identity, lastError: 'unsupported delegation' }
        return this.statusValue
      }

      const [records, targetBalance, quoteBalance, targetPriceE18] = await Promise.all([
        this.loadRecords(blockNumber),
        this.reader.readBalance(delegation.targetAsset, this.config.vault, blockNumber),
        this.reader.readBalance(delegation.quoteAsset, this.config.vault, blockNumber),
        this.reader.readSpotPriceE18(delegation.allowedDexes[0] as Address, delegation.targetAsset, blockNumber),
      ])
      const pnl = computePnl({
        vault: this.config.vault,
        baseline,
        current: { blockNumber, targetBalance, quoteBalance, targetPriceE18 },
        operatingSpent: delegation.operatingSpent,
        records,
      })
      if (pnl.status === 'cashflow_unknown') {
        this.statusValue = { phase: 'idle', ...identity, lastError: 'cashflow_unknown' }
        return this.statusValue
      }

      const base: KeeperStatus = {
        phase: 'idle',
        ...identity,
        snapshot: {
          delegationId: String(delegation.delegationId),
          configHash: delegation.configHash,
          blockNumber: String(blockNumber),
          targetBalance: String(targetBalance),
          quoteBalance: String(quoteBalance),
          targetPriceE18: String(targetPriceE18),
          valueQuote: String(pnl.currentValueQuote),
        },
        lossReport: {
          delegationId: String(delegation.delegationId),
          configHash: delegation.configHash,
          reportId: pnl.reportId,
          baselineBlock: String(baseline.blockNumber),
          currentBlock: String(blockNumber),
          baselineValueQuote: String(baseline.valueQuote),
          currentValueQuote: String(pnl.currentValueQuote),
          operatingSpent: String(delegation.operatingSpent),
          pnlQuote: String(pnl.pnlQuote ?? 0n),
          pnlBps: pnl.pnlBps ?? (0 as Bps),
          priceSource: baseline.pricingDex,
          status: pnl.status,
        },
      }

      const latest = [...records]
        .reverse()
        .find(
          (record) =>
            record.kind === 'decided' &&
            record.delegationId === delegation.delegationId &&
            record.evidence,
        )
      if (latest?.kind === 'decided' && latest.evidence) {
        const executed = records.some(
          (record) =>
            record.kind === 'executed' &&
            record.delegationId === latest.delegationId &&
            record.decisionId === latest.decisionId,
        )
        const skipped = records.find(
          (record) =>
            record.kind === 'not_executed' &&
            record.delegationId === latest.delegationId &&
            record.decisionId === latest.decisionId,
        )
        const outcome = executed ? 'executed' : skipped?.kind === 'not_executed'
          ? skipped.reason === 'within_band' ? 'held' : 'skipped'
          : undefined
        const expectedOutcome = outcome ?? 'asked'
        const cached = this.narrationCache.get(`${latest.delegationId}:${latest.decisionId}`)
        const narration = cached?.outcome === expectedOutcome ? cached.narration : {
          text: templateNarration({ ...latest.evidence, outcome: expectedOutcome }),
          fallback: true,
        }
        this.statusValue = {
          ...base,
          ...(outcome
            ? {
                lastDecision: {
                  delegationId: String(latest.delegationId),
                  configHash: delegation.configHash,
                  decisionId: latest.decisionId,
                  outcome,
                },
              }
            : {}),
          narration: {
            delegationId: String(latest.delegationId),
            configHash: delegation.configHash,
            decisionId: latest.decisionId,
            ...narration,
          },
        }
      } else {
        this.statusValue = base
      }

      if (pending.open) {
        const request = await this.reader.readPendingRequest(this.config.vault, pending, blockNumber)
        if (!request) {
          this.statusValue = { ...base, phase: 'awaiting_approval', lastError: 'pending event mismatch' }
          return this.statusValue
        }
        const price = sameAddress(request.trade.tokenIn, delegation.quoteAsset)
          ? PRICE_SCALE
          : await this.reader.readSpotPriceE18(request.dex, request.trade.tokenIn, request.blockNumber)
        const totalValue = (request.trade.amountIn * price) / PRICE_SCALE
        const trust = computeTrust(records, id, delegation.trustFormulaVersion)
        const trustCap =
          (delegation.autoThreshold * BigInt(trust.discretionBps as number)) / BigInt(BPS_DENOMINATOR)
        const effectiveCap = trustCap < delegation.autoThreshold ? trustCap : delegation.autoThreshold
        this.statusValue = {
          ...this.statusValue,
          phase: 'awaiting_approval',
          pending: {
            delegationId: String(delegation.delegationId),
            configHash: delegation.configHash,
            stateNonce: String(delegation.stateNonce),
            decisionId: pending.decisionId,
            dex: request.dex,
            trade: request.trade,
            evidence: request.evidence,
            expiresAt: String(pending.expiresAt),
            effectiveCap: String(effectiveCap),
            overBy: String(totalValue > effectiveCap ? totalValue - effectiveCap : 0n),
            capSource: effectiveCap < delegation.autoThreshold ? 'trust' : 'user',
          },
        }
      }
      return this.statusValue
    } catch (error) {
      this.statusValue = {
        ...this.statusValue,
        phase: 'idle',
        lastError: error instanceof Error ? error.message : 'status unavailable',
      }
      return this.statusValue
    }
  }

  tick(): Promise<TickResult> {
    if (this.inFlight) return this.inFlight
    this.statusValue = { ...this.statusValue, phase: 'deciding' }
    this.inFlight = this.runTick()
      .catch((error) => {
        this.statusValue = {
          ...this.statusValue,
          phase: this.statusValue.pending ? 'awaiting_approval' : 'idle',
          lastError: error instanceof Error ? error.message : 'unknown error',
        }
        throw error
      })
      .finally(() => {
        this.inFlight = undefined
      })
    return this.inFlight
  }

  private validateDelegation(delegation: OnChainDelegation, baseline: PortfolioBaseline): CharacterId | undefined {
    const id = characterId(delegation.characterId)
    if (!id || delegation.trustFormulaVersion !== SUPPORTED_TRUST_FORMULA_VERSION) return undefined
    if (strategyHash(characterOf(id)) !== delegation.strategyHash) return undefined
    if (delegation.delegationId !== baseline.delegationId) return undefined
    if (!sameAddress(delegation.quoteAsset, baseline.quoteAsset)) return undefined
    if (!sameAddress(delegation.targetAsset, baseline.targetAsset)) return undefined
    if (delegation.allowedAssets.length !== 2 || delegation.allowedDexes.length !== 1) return undefined
    if (!sameAddress(delegation.allowedDexes[0] as Address, baseline.pricingDex)) return undefined
    if (!delegation.allowedAssets.some((asset) => sameAddress(asset, delegation.targetAsset))) return undefined
    if (!delegation.allowedAssets.some((asset) => sameAddress(asset, delegation.quoteAsset))) return undefined
    return id
  }

  private async runTick(): Promise<TickResult> {
    const { vault } = this.config
    const blockNumber = await this.reader.getBlockNumber()
    const [delegation, baseline, pending, blockTimestamp] = await Promise.all([
      this.reader.readDelegation(vault, blockNumber),
      this.reader.readPortfolioBaseline(vault, blockNumber),
      this.reader.readPendingDecision(vault, blockNumber),
      this.reader.getBlockTimestamp(blockNumber),
    ])
    const identity = {
      delegationId: delegation.delegationId === 0n ? null : String(delegation.delegationId),
      configHash: delegation.configHash,
    } as const
    this.statusValue = { phase: 'deciding', ...identity }

    if (delegation.expiry === 0n) {
      this.statusValue = { phase: 'idle', ...identity }
      return { kind: 'inactive', reason: 'revoked' }
    }
    if (blockTimestamp > delegation.expiry) {
      this.statusValue = { phase: 'idle', ...identity }
      return { kind: 'inactive', reason: 'expired' }
    }

    const id = this.validateDelegation(delegation, baseline)
    if (!id || baseline.characterId !== id) {
      this.statusValue = { phase: 'idle', ...identity, lastError: 'unsupported delegation' }
      return { kind: 'inactive', reason: 'unsupported_delegation' }
    }

    const pendingResult = await this.handlePending(pending, delegation, blockTimestamp, blockNumber, id)
    if (pendingResult) return pendingResult

    const [targetBalance, quoteBalance, records] = await Promise.all([
      this.reader.readBalance(delegation.targetAsset, vault, blockNumber),
      this.reader.readBalance(delegation.quoteAsset, vault, blockNumber),
      this.loadRecords(blockNumber),
    ])
    const holdings: Holding[] = [
      { asset: delegation.targetAsset, amount: targetBalance, decimals: 18 },
      { asset: delegation.quoteAsset, amount: quoteBalance, decimals: 18 },
    ]

    const cashflow = computePnl({
      vault,
      baseline,
      current: { blockNumber, targetBalance, quoteBalance, targetPriceE18: baseline.targetPriceE18 },
      operatingSpent: delegation.operatingSpent,
      records,
    })
    if (cashflow.status === 'cashflow_unknown') {
      this.statusValue = { phase: 'idle', ...identity, lastError: 'cashflow_unknown' }
      return { kind: 'inactive', reason: 'cashflow_unknown' }
    }

    const strategy = characterOf(id)
    const dataCost = await this.meter.quote({ kind: 'price_data' })
    const correctable = this.roughCorrectableValue(holdings, strategy.bandBps)
    if (correctable !== undefined && dataCost >= correctable) {
      return { kind: 'skipped', reason: 'cost_exceeds_benefit' }
    }

    try {
      await this.meter.acquire(
        { kind: 'price_data' },
        remaining(delegation.budget, delegation.budgetSpent),
        remaining(delegation.operatingCap, delegation.operatingSpent),
      )
    } catch (error) {
      this.meter.discard()
      if (error instanceof BudgetExhaustedError) return { kind: 'skipped', reason: 'budget_exhausted' }
      return { kind: 'skipped', reason: 'stale_price' }
    }

    let snapshot: PriceSnapshot
    try {
      snapshot = await this.acquireSnapshot(delegation, blockNumber)
    } catch {
      this.meter.discard()
      return { kind: 'skipped', reason: 'stale_price' }
    }
    if (!isFresh(snapshot, blockNumber)) {
      this.meter.discard()
      return { kind: 'skipped', reason: 'stale_price' }
    }
    this.lastSnapshot = snapshot

    const pnl = computePnl({
      vault,
      baseline,
      current: { blockNumber, targetBalance, quoteBalance, targetPriceE18: snapshot.prices[0]!.priceE18 },
      operatingSpent: delegation.operatingSpent,
      records,
    })
    this.statusValue = {
      phase: 'deciding',
      ...identity,
      snapshot: {
        delegationId: String(delegation.delegationId),
        configHash: delegation.configHash,
        blockNumber: String(blockNumber),
        targetBalance: String(targetBalance),
        quoteBalance: String(quoteBalance),
        targetPriceE18: String(snapshot.prices[0]!.priceE18),
        valueQuote: String(pnl.currentValueQuote),
      },
      lossReport: {
        delegationId: String(delegation.delegationId),
        configHash: delegation.configHash,
        reportId: pnl.reportId,
        baselineBlock: String(baseline.blockNumber),
        currentBlock: String(blockNumber),
        baselineValueQuote: String(baseline.valueQuote),
        currentValueQuote: String(pnl.currentValueQuote),
        operatingSpent: String(delegation.operatingSpent),
        pnlQuote: String(pnl.pnlQuote ?? 0n),
        pnlBps: pnl.pnlBps ?? (0 as Bps),
        priceSource: baseline.pricingDex,
        status: pnl.status,
      },
    }

    const target = {
      weights: [
        { asset: delegation.targetAsset, bps: delegation.targetAssetBps },
        { asset: delegation.quoteAsset, bps: (BPS_DENOMINATOR - (delegation.targetAssetBps as number)) as Bps },
      ],
    }
    const baseInput = {
      target,
      strategy,
      holdings,
      price: snapshot,
      currentBlock: blockNumber,
      slippageToleranceBps: delegation.slippageToleranceBps,
    } as const
    const preliminary = decide({
      ...baseInput,
      costEstimate: {
        gasValue: this.config.gasValueEstimate,
        slippageValue: 0n,
        operatingValue: this.meter.pendingTotal(),
      },
    })

    let slippageValue = 0n
    let quotedAmountOut: bigint | undefined
    const candidate = preliminary.trades[0]
    if (preliminary.kind === 'rebalance' && candidate) {
      try {
        const amountOut = await this.reader.readAmountOut(
          delegation.allowedDexes[0] as Address,
          candidate.tokenIn,
          candidate.amountIn,
          blockNumber,
        )
        quotedAmountOut = amountOut
        const priceOf = new Map(snapshot.prices.map((price) => [price.asset.toLowerCase(), price.priceE18]))
        const valueIn = (candidate.amountIn * (priceOf.get(candidate.tokenIn.toLowerCase()) ?? 0n)) / PRICE_SCALE
        const valueOut = (amountOut * (priceOf.get(candidate.tokenOut.toLowerCase()) ?? 0n)) / PRICE_SCALE
        slippageValue = valueIn > valueOut ? valueIn - valueOut : 0n
      } catch {
        this.meter.discard()
        return { kind: 'skipped', reason: 'stale_price' }
      }
    }

    const decision = decide({
      ...baseInput,
      costEstimate: {
        gasValue: this.config.gasValueEstimate,
        slippageValue,
        operatingValue: this.meter.pendingTotal(),
      },
    })
    const write = {
      vault,
      delegationId: delegation.delegationId,
      stateNonce: delegation.stateNonce,
      decisionId: decision.id,
      evidence: encodeEvidence(decision.evidence),
      priceCost: this.meter.pendingTotal(),
    }

    if (decision.kind !== 'rebalance') {
      try {
        await this.writer.recordNotExecuted({
          ...write,
          reason: skipReasonCode(decision.skipReason ?? 'within_band'),
        })
      } finally {
        this.meter.discard()
      }
      const outcome = decision.kind === 'hold' ? 'held' : 'skipped'
      this.statusValue = {
        ...this.statusValue,
        phase: 'idle',
        lastDecision: {
          delegationId: String(delegation.delegationId),
          configHash: delegation.configHash,
          decisionId: decision.id,
          outcome,
        },
      }
      await this.updateNarration(delegation, decision.id, { ...decision.evidence, outcome })
      return { kind: 'skipped', reason: decision.skipReason ?? 'within_band', decisionId: decision.id }
    }

    const trust = computeTrust(records, id, delegation.trustFormulaVersion)
    const gate = resolveGate(decision, trust, {
      maxTradeValue: delegation.maxTradeValue,
      autoThreshold: delegation.autoThreshold,
      budget: delegation.budget,
      budgetSpent: delegation.budgetSpent,
      expiry: delegation.expiry,
      allowedAssets: delegation.allowedAssets,
      allowedDexes: delegation.allowedDexes,
    }, blockTimestamp)
    const decidedTrade = decision.trades[0]
    const trade = decidedTrade && quotedAmountOut !== undefined
      ? {
          ...decidedTrade,
          minAmountOut:
            (quotedAmountOut * BigInt(BPS_DENOMINATOR - (delegation.slippageToleranceBps as number))) /
            BigInt(BPS_DENOMINATOR),
        }
      : decidedTrade
    const dex = delegation.allowedDexes[0]
    if (!trade || !dex) {
      this.meter.discard()
      return { kind: 'skipped', reason: 'within_band', decisionId: decision.id }
    }

    if (gate.action === 'reject') {
      try {
        await this.writer.recordNotExecuted({ ...write, reason: gateReasonCode(gate.reason) })
      } finally {
        this.meter.discard()
      }
      this.statusValue = {
        ...this.statusValue,
        phase: 'idle',
        lastDecision: {
          delegationId: String(delegation.delegationId),
          configHash: delegation.configHash,
          decisionId: decision.id,
          outcome: 'skipped',
        },
      }
      await this.updateNarration(delegation, decision.id, { ...decision.evidence, outcome: 'skipped' })
      return { kind: 'rejected', decisionId: decision.id, reason: gate.reason }
    }

    if (gate.action === 'ask') {
      try {
        await this.writer.propose({ ...write, dex, trade })
        this.statusValue = {
          ...this.statusValue,
          phase: 'awaiting_approval',
          pending: {
            delegationId: String(delegation.delegationId),
            configHash: delegation.configHash,
            stateNonce: String(delegation.stateNonce + 1n),
            decisionId: decision.id,
            dex,
            trade,
            evidence: decision.evidence,
            expiresAt: String(blockTimestamp + delegation.approvalTtlSeconds),
            effectiveCap: String(gate.effectiveCap),
            overBy: String(gate.overBy),
            capSource: gate.capSource,
          },
        }
      } finally {
        this.meter.discard()
      }
      await this.updateNarration(delegation, decision.id, decision.evidence)
      return { kind: 'asked', decisionId: decision.id, overBy: gate.overBy, effectiveCap: gate.effectiveCap }
    }

    try {
      const txHash = await this.writer.executeAuto({ ...write, dex, trade })
      this.statusValue = {
        ...this.statusValue,
        phase: 'idle',
        lastDecision: {
          delegationId: String(delegation.delegationId),
          configHash: delegation.configHash,
          decisionId: decision.id,
          outcome: 'executed',
        },
      }
      await this.updateNarration(delegation, decision.id, { ...decision.evidence, outcome: 'executed' })
      return { kind: 'executed', decisionId: decision.id, txHash, value: decision.totalValue }
    } catch (error) {
      await this.writer.recordNotExecuted({ ...write, reason: NOT_EXECUTED_REASON.execution_failed })
      this.statusValue = {
        ...this.statusValue,
        phase: 'idle',
        lastDecision: {
          delegationId: String(delegation.delegationId),
          configHash: delegation.configHash,
          decisionId: decision.id,
          outcome: 'skipped',
        },
      }
      await this.updateNarration(delegation, decision.id, { ...decision.evidence, outcome: 'skipped' })
      return {
        kind: 'rejected',
        decisionId: decision.id,
        reason: error instanceof Error ? error.message : 'execution_failed',
      }
    } finally {
      this.meter.discard()
    }
  }

  private async handlePending(
    pending: PendingDecision,
    delegation: OnChainDelegation,
    blockTimestamp: bigint,
    blockNumber: bigint,
    id: CharacterId,
  ): Promise<TickResult | undefined> {
    if (!pending.open) {
      return undefined
    }
    if (
      pending.delegationId !== delegation.delegationId ||
      pending.proposalNonce + 1n !== delegation.stateNonce
    ) {
      return { kind: 'inactive', reason: 'unsupported_delegation' }
    }
    if (blockTimestamp <= pending.expiresAt) {
      const request = await this.reader.readPendingRequest(this.config.vault, pending, blockNumber)
      if (!request) {
        this.statusValue = {
          phase: 'awaiting_approval',
          delegationId: String(delegation.delegationId),
          configHash: delegation.configHash,
          lastError: 'pending event mismatch',
        }
        return { kind: 'awaiting_approval', decisionId: pending.decisionId, expiresAt: pending.expiresAt }
      }
      const records = await this.loadRecords(blockNumber)
      const price = sameAddress(request.trade.tokenIn, delegation.quoteAsset)
        ? PRICE_SCALE
        : await this.reader.readSpotPriceE18(request.dex, request.trade.tokenIn, request.blockNumber)
      const totalValue = (request.trade.amountIn * price) / PRICE_SCALE
      const trust = computeTrust(records, id, delegation.trustFormulaVersion)
      const trustCap =
        (delegation.autoThreshold * BigInt(trust.discretionBps as number)) / BigInt(BPS_DENOMINATOR)
      const effectiveCap = trustCap < delegation.autoThreshold ? trustCap : delegation.autoThreshold
      const view: PendingView = {
        delegationId: String(delegation.delegationId),
        configHash: delegation.configHash,
        stateNonce: String(delegation.stateNonce),
        decisionId: pending.decisionId,
        dex: request.dex,
        trade: request.trade,
        evidence: request.evidence,
        expiresAt: String(pending.expiresAt),
        effectiveCap: String(effectiveCap),
        overBy: String(totalValue > effectiveCap ? totalValue - effectiveCap : 0n),
        capSource: effectiveCap < delegation.autoThreshold ? 'trust' : 'user',
      }
      this.statusValue = {
        phase: 'awaiting_approval',
        delegationId: String(delegation.delegationId),
        configHash: delegation.configHash,
        pending: view,
        narration: {
          delegationId: String(delegation.delegationId),
          configHash: delegation.configHash,
          decisionId: pending.decisionId,
          text: templateNarration(request.evidence),
          fallback: true,
        },
      }
      return { kind: 'awaiting_approval', decisionId: pending.decisionId, expiresAt: pending.expiresAt }
    }
    await this.writer.expire({
      vault: this.config.vault,
      delegationId: delegation.delegationId,
      stateNonce: delegation.stateNonce,
      decisionId: pending.decisionId,
    })
    this.statusValue = {
      phase: 'idle',
      delegationId: String(delegation.delegationId),
      configHash: delegation.configHash,
      lastDecision: {
        delegationId: String(delegation.delegationId),
        configHash: delegation.configHash,
        decisionId: pending.decisionId,
        outcome: 'skipped',
      },
    }
    return { kind: 'skipped', reason: 'expired', decisionId: pending.decisionId }
  }

  private async updateNarration(
    delegation: OnChainDelegation,
    decisionId: DecisionId,
    evidence: DecisionEvidence,
  ): Promise<void> {
    const key = `${delegation.delegationId}:${decisionId}`
    const cached = this.narrationCache.get(key)
    let result = cached?.outcome === evidence.outcome ? cached.narration : undefined
    if (!result) {
      const fallback = { text: templateNarration(evidence), fallback: true } as const
      if (!this.llm) {
        result = fallback
      } else {
        try {
          const blockNumber = await this.reader.getBlockNumber()
          const alreadyCharged = await this.reader.readNarrationCostRecorded(
            this.config.vault,
            delegation.delegationId,
            decisionId,
            blockNumber,
          )
          if (alreadyCharged) {
            result = fallback
          } else {
            const latest = await this.reader.readDelegation(this.config.vault, blockNumber)
            const receipt = await this.meter.acquire(
              { kind: 'narration' },
              remaining(latest.budget, latest.budgetSpent),
              remaining(latest.operatingCap, latest.operatingSpent),
            )
            await this.writer.chargeNarrationCost({
              vault: this.config.vault,
              delegationId: delegation.delegationId,
              decisionId,
              amount: receipt.amount,
            })
            this.meter.discard()
            result = await narrate(evidence, PERSONAS[characterId(delegation.characterId) ?? 'timid'], this.llm)
          }
        } catch {
          this.meter.discard()
          result = fallback
        }
      }
      this.narrationCache.set(key, { narration: result, outcome: evidence.outcome })
    }
    this.statusValue = {
      ...this.statusValue,
      narration: {
        delegationId: String(delegation.delegationId),
        configHash: delegation.configHash,
        decisionId,
        ...result,
      },
    }
  }

  private roughCorrectableValue(holdings: readonly Holding[], bandBps: Bps): bigint | undefined {
    if (!this.lastSnapshot) return undefined
    const priceOf = new Map(this.lastSnapshot.prices.map((price) => [price.asset.toLowerCase(), price.priceE18]))
    let total = 0n
    for (const holding of holdings) {
      const price = priceOf.get(holding.asset.toLowerCase())
      if (price === undefined) return undefined
      total += (holding.amount * price) / PRICE_SCALE
    }
    return (total * BigInt(bandBps as number)) / BigInt(BPS_DENOMINATOR)
  }

  private async acquireSnapshot(delegation: OnChainDelegation, blockNumber: bigint): Promise<PriceSnapshot> {
    const pool = delegation.allowedDexes[0] as Address
    const targetPrice = await this.reader.readSpotPriceE18(pool, delegation.targetAsset, blockNumber)
    return {
      blockNumber,
      pool,
      quoteAsset: delegation.quoteAsset,
      prices: [
        { asset: delegation.targetAsset, priceE18: targetPrice },
        { asset: delegation.quoteAsset, priceE18: PRICE_SCALE },
      ],
      maxAgeBlocks: this.config.maxAgeBlocks,
    }
  }

}
