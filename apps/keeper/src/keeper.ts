import type {
  Address,
  Bps,
  CharacterId,
  Decision,
  DecisionEvidence,
  DecisionId,
  Holding,
  PortfolioTarget,
  PriceSnapshot,
  SkipReason,
  TrackRecord,
} from '@soon/shared'
import { BPS_DENOMINATOR, canonical, characterOf, computeTrust, decide, resolveGate, sameAddress } from '@soon/engine'
import { NOT_EXECUTED_REASON } from './abi.js'
import { BudgetExhaustedError, CostMeter } from './payment.js'
import type { ChainReader, VaultWriter } from './ports.js'
import { isFresh } from './priceSource.js'

export type TickResult =
  | { kind: 'inactive'; reason: 'revoked' | 'expired' }
  | { kind: 'skipped'; reason: SkipReason | 'budget_exhausted'; decisionId?: DecisionId }
  | { kind: 'executed'; decisionId: DecisionId; txHash: `0x${string}`; value: bigint }
  | { kind: 'asked'; decisionId: DecisionId; overBy: bigint; effectiveCap: bigint }
  | { kind: 'rejected'; decisionId: DecisionId; reason: string }

export type PendingApproval = {
  decision: Decision
  dex: Address
  createdAtBlock: bigint
  expiresAtBlock: bigint
}

export type KeeperConfig = {
  vault: Address
  pool: Address
  characterId: CharacterId
  target: PortfolioTarget
  assets: readonly Address[]
  slippageToleranceBps: Bps
  maxAgeBlocks: bigint
  /** 승인 요청이 이 블록 수 안에 처리되지 않으면 만료된다 (R5.4). */
  approvalTtlBlocks: bigint
  gasValueEstimate: bigint
}

function utf8ToHex(s: string): `0x${string}` {
  const bytes = new TextEncoder().encode(s)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return `0x${out}`
}

function encodeEvidence(e: DecisionEvidence): `0x${string}` {
  return utf8ToHex(canonical(e))
}

/** 판단의 스킵 사유를 온체인 코드로 옮긴다. 빠짐없이 다루도록 switch로 쓴다. */
function skipReasonCode(reason: SkipReason): number {
  switch (reason) {
    case 'within_band':
      return NOT_EXECUTED_REASON.within_band
    case 'below_min_trade':
      return NOT_EXECUTED_REASON.below_min_trade
    case 'cost_exceeds_benefit':
      return NOT_EXECUTED_REASON.cost_exceeds_benefit
    case 'stale_price':
      return NOT_EXECUTED_REASON.stale_price
  }
}

/**
 * 자동 실행을 돌리는 프로세스.
 *
 * 사용자가 브라우저를 닫아도 리밸런싱이 성립하려면 상시 도는 주체가 필요하다 (R5.1).
 * 이 프로세스의 키는 볼트의 execute·chargeCost만 부를 수 있고 인출은 못 한다 —
 * 여기가 뚫려도 손실은 볼트 한도 안으로 묶인다 (ADR-0001).
 */
export class Keeper {
  private lastSnapshot: PriceSnapshot | undefined
  private pending = new Map<DecisionId, PendingApproval>()

  constructor(
    private readonly reader: ChainReader,
    private readonly writer: VaultWriter,
    private readonly meter: CostMeter,
    private readonly config: KeeperConfig,
    private readonly loadRecords: () => Promise<readonly TrackRecord[]>,
  ) {}

  pendingApprovals(): readonly PendingApproval[] {
    return [...this.pending.values()]
  }

  /**
   * 이 판단으로 교정할 수 있는 가치의 대략적인 상한.
   * 직전 스냅샷으로 계산하므로 정확하지 않지만, 데이터를 살 값어치가 있는지
   * 가늠하는 데는 충분하다.
   */
  private roughCorrectableValue(holdings: readonly Holding[], bandBps: Bps): bigint | undefined {
    const snap = this.lastSnapshot
    if (!snap) return undefined

    const priceOf = new Map(snap.prices.map((p) => [p.asset.toLowerCase(), p.priceE18]))
    let total = 0n
    for (const h of holdings) {
      const p = priceOf.get(h.asset.toLowerCase())
      if (p === undefined) return undefined
      total += (h.amount * p) / 1_000_000_000_000_000_000n
    }
    return (total * BigInt(bandBps as number)) / BigInt(BPS_DENOMINATOR)
  }

  private async readHoldings(): Promise<Holding[]> {
    return Promise.all(
      this.config.assets.map(async (asset) => ({
        asset,
        amount: await this.reader.readBalance(asset, this.config.vault),
        decimals: 18,
      })),
    )
  }

  async tick(): Promise<TickResult> {
    const cfg = this.config
    const strategy = characterOf(cfg.characterId)
    const delegation = await this.reader.readDelegation(cfg.vault)
    const currentBlock = await this.reader.getBlockNumber()
    const currentTimestamp = await this.reader.getBlockTimestamp()

    // 1. 위임이 살아 있는지. 철회·만료면 아무것도 하지 않는다 (R3.4, R3.5).
    //    만료는 볼트와 같은 단위(초)로 잰다 — 블록 번호와 섞으면 판정이 어긋난다.
    if (delegation.expiry === 0n) return { kind: 'inactive', reason: 'revoked' }
    if (currentTimestamp > delegation.expiry) return { kind: 'inactive', reason: 'expired' }

    await this.expireStaleApprovals(currentBlock)

    const holdings = await this.readHoldings()

    // 2. 데이터를 사기 전에, 그 값이 교정 이득을 넘는지 먼저 따진다 (R4.7).
    //    사고 나서 후회하면 이미 예산이 나간 뒤다.
    const dataCost = await this.meter.quote({ kind: 'price_data' })
    const correctable = this.roughCorrectableValue(holdings, strategy.bandBps)
    if (correctable !== undefined && dataCost >= correctable) {
      return { kind: 'skipped', reason: 'cost_exceeds_benefit' }
    }

    // 3. 가격을 사서 스냅샷으로 고정한다.
    let snapshot: PriceSnapshot
    try {
      await this.meter.charge({ kind: 'price_data' })
      snapshot = await this.acquireSnapshot(delegation.quoteAsset, currentBlock)
    } catch (e) {
      this.meter.discard()
      if (e instanceof BudgetExhaustedError) {
        return { kind: 'skipped', reason: 'budget_exhausted' }
      }
      return { kind: 'skipped', reason: 'stale_price' }
    }

    if (!isFresh(snapshot, currentBlock)) {
      this.meter.discard()
      return { kind: 'skipped', reason: 'stale_price' }
    }

    // 4. 판단. 순수 함수이고 신뢰 점수를 받지 않는다 (R4.8).
    const decision = decide({
      target: cfg.target,
      strategy,
      holdings,
      price: snapshot,
      costEstimate: {
        gasValue: cfg.gasValueEstimate,
        slippageValue: 0n,
        operatingValue: this.meter.pendingTotal(),
      },
      currentBlock,
      slippageToleranceBps: cfg.slippageToleranceBps,
    })

    const evidence = encodeEvidence(decision.evidence)

    // 5. 거래가 없으면 그 사실을 남긴다. 실행되지 않은 판단도 기록한다 (R7.4).
    if (decision.kind !== 'rebalance') {
      await this.meter.commit(decision.id)
      await this.writer.recordNotExecuted({
        vault: cfg.vault,
        decisionId: decision.id,
        characterId: cfg.characterId,
        evidence,
        reason: skipReasonCode(decision.skipReason ?? 'within_band'),
      })
      return { kind: 'skipped', reason: decision.skipReason ?? 'within_band', decisionId: decision.id }
    }

    // 6. 신뢰는 여기서만 쓰인다 — 거래 내용이 아니라 승인 경계에만 영향을 준다.
    const trust = computeTrust(await this.loadRecords())
    const gate = resolveGate(decision, trust, {
      maxTradeValue: delegation.maxTradeValue,
      autoThreshold: delegation.autoThreshold,
      budget: delegation.budget,
      budgetSpent: await this.reader.readBudgetSpent(cfg.vault),
      expiry: delegation.expiry,
      allowedAssets: delegation.allowedAssets,
      allowedDexes: delegation.allowedDexes,
    }, currentTimestamp)

    const dex = delegation.allowedDexes[0] ?? cfg.pool

    if (gate.action === 'reject') {
      await this.meter.commit(decision.id)
      await this.writer.recordNotExecuted({
        vault: cfg.vault,
        decisionId: decision.id,
        characterId: cfg.characterId,
        evidence,
        reason: gate.reason === 'expired' ? NOT_EXECUTED_REASON.expired : NOT_EXECUTED_REASON.budget_exhausted,
      })
      return { kind: 'rejected', decisionId: decision.id, reason: gate.reason }
    }

    if (gate.action === 'ask') {
      // 임계값을 넘으면 멈추고 사용자에게 묻는다 (R5.2).
      await this.meter.commit(decision.id)
      this.pending.set(decision.id, {
        decision,
        dex,
        createdAtBlock: currentBlock,
        expiresAtBlock: currentBlock + cfg.approvalTtlBlocks,
      })
      return { kind: 'asked', decisionId: decision.id, overBy: gate.overBy, effectiveCap: gate.effectiveCap }
    }

    // 7. 임계값 안이면 알아서 실행하고 사후 보고한다 (R5.1).
    const trade = decision.trades[0]
    if (!trade) {
      this.meter.discard()
      return { kind: 'skipped', reason: 'within_band', decisionId: decision.id }
    }

    const txHash = await this.writer.execute({
      vault: cfg.vault,
      dex,
      trade,
      decisionId: decision.id,
      characterId: cfg.characterId,
      evidence,
    })
    await this.meter.commit(decision.id)

    return { kind: 'executed', decisionId: decision.id, txHash, value: decision.totalValue }
  }

  /** 사용자가 승인한 요청을 실행한다. */
  async approve(decisionId: DecisionId): Promise<TickResult> {
    const p = this.pending.get(decisionId)
    if (!p) return { kind: 'rejected', decisionId, reason: 'unknown_request' }

    const trade = p.decision.trades[0]
    if (!trade) return { kind: 'rejected', decisionId, reason: 'no_trade' }

    const txHash = await this.writer.execute({
      vault: this.config.vault,
      dex: p.dex,
      trade,
      decisionId,
      characterId: this.config.characterId,
      evidence: encodeEvidence(p.decision.evidence),
    })
    this.pending.delete(decisionId)
    return { kind: 'executed', decisionId, txHash, value: p.decision.totalValue }
  }

  /** 사용자가 거절한다. 거절도 트랙레코드에 남는다 (R5.5). */
  async reject(decisionId: DecisionId): Promise<void> {
    const p = this.pending.get(decisionId)
    if (!p) return
    this.pending.delete(decisionId)
    await this.writer.recordNotExecuted({
      vault: this.config.vault,
      decisionId,
      characterId: this.config.characterId,
      evidence: encodeEvidence(p.decision.evidence),
      reason: NOT_EXECUTED_REASON.rejected,
    })
  }

  /** 답이 없는 요청은 만료시킨다. 만료 사실도 남긴다 (R5.4). */
  private async expireStaleApprovals(currentBlock: bigint): Promise<void> {
    for (const [id, p] of [...this.pending]) {
      if (currentBlock > p.expiresAtBlock) {
        this.pending.delete(id)
        await this.writer.recordNotExecuted({
          vault: this.config.vault,
          decisionId: id,
          characterId: this.config.characterId,
          evidence: encodeEvidence(p.decision.evidence),
          reason: NOT_EXECUTED_REASON.expired,
        })
      }
    }
  }

  private async acquireSnapshot(quoteAsset: Address, blockNumber: bigint): Promise<PriceSnapshot> {
    const prices = await Promise.all(
      this.config.assets.map(async (asset) => ({
        asset,
        // quote 자산은 자기 자신에 대해 1이다. 주소 표기가 섞여 들어오므로 정규화해 비교한다.
        priceE18: sameAddress(asset, quoteAsset)
          ? 1_000_000_000_000_000_000n
          : await this.reader.readSpotPriceE18(this.config.pool, asset),
      })),
    )
    const snapshot: PriceSnapshot = {
      blockNumber,
      pool: this.config.pool,
      quoteAsset,
      prices,
      maxAgeBlocks: this.config.maxAgeBlocks,
    }
    this.lastSnapshot = snapshot
    return snapshot
  }
}
