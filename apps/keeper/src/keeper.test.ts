import { describe, expect, it } from 'vitest'
import type { Address, CostKind, DecisionId, TrackRecord } from '@soon/shared'
import { bps } from '@soon/engine'
import { Keeper, type KeeperConfig } from './keeper.js'
import { CostMeter, type PaymentAdapter, type ResourceRef } from './payment.js'
import type { LlmClient } from './narrator.js'
import { VaultBudgetAdapter } from './vaultBudgetAdapter.js'
import type { ChainReader, OnChainDelegation, PendingRequest, VaultWriter } from './ports.js'

const TOKEN: Address = '0x1111111111111111111111111111111111111111'
const USDC: Address = '0x2222222222222222222222222222222222222222'
const POOL: Address = '0x3333333333333333333333333333333333333333'
const VAULT: Address = '0x4444444444444444444444444444444444444444'

/** 체인을 흉내내는 최소 구현. 실제 노드 없이 파이프라인 전체를 돌린다. */
class FakeChain implements ChainReader {
  block = 100n
  readBlocks: bigint[] = []
  quoteCalls = 0
  tokenPriceE18 = 2_000_000_000n
  balances = new Map<Address, bigint>([
    [TOKEN, 3_000_000_000_000_000_000n], // 3개 = $6000
    [USDC, 4_000_000_000n], //              $4000
  ])
  budgetSpent = 0n
  delegation: OnChainDelegation = {
    delegationId: 1n,
    configHash: `0x${'11'.repeat(32)}`,
    stateNonce: 0n,
    executor: '0x5555555555555555555555555555555555555555',
    characterId: 'timid',
    strategyHash: '0x4acec38fbb39d62ac2bb9c262fcbf617a3cb5235fbd17c73f35b70870ba8ac47',
    trustFormulaVersion: 1,
    quoteAsset: USDC,
    maxTradeValue: 1_000_000_000n, // $1000
    autoThreshold: 1_000_000_000n, // $1000
    budget: 5_000_000_000n,
    budgetSpent: 0n,
    operatingCap: 50_000_000n,
    operatingSpent: 0n,
    expiry: 2_000_000n, // 체인 시각(초) 기준
    approvalTtlSeconds: 3_600n,
    slippageToleranceBps: bps(50),
    targetAsset: TOKEN,
    targetAssetBps: bps(6_000),
    allowedAssets: [TOKEN, USDC],
    allowedDexes: [POOL],
  }

  timestamp = 1_000_000n
  pending = {
    delegationId: 0n,
    proposalNonce: 0n,
    decisionId: `0x${'00'.repeat(32)}` as DecisionId,
    orderHash: `0x${'00'.repeat(32)}` as DecisionId,
    evidenceHash: `0x${'00'.repeat(32)}` as DecisionId,
    expiresAt: 0n,
    open: false,
  }
  baseline = {
    delegationId: 1n,
    characterId: 'timid' as const,
    quoteAsset: USDC,
    pricingDex: POOL,
    targetAsset: TOKEN,
    targetBalance: 3_000_000_000_000_000_000n,
    quoteBalance: 4_000_000_000n,
    targetPriceE18: 2_000_000_000n,
    valueQuote: 10_000_000_000n,
    blockNumber: 1n,
  }
  pendingRequest: PendingRequest | undefined
  narrationRecorded = false

  async getBlockNumber() {
    return this.block
  }
  async getBlockTimestamp(_blockNumber: bigint) {
    this.readBlocks.push(_blockNumber)
    return this.timestamp
  }
  async readSpotPriceE18(_pool: Address, asset: Address, _blockNumber: bigint) {
    this.readBlocks.push(_blockNumber)
    return asset === TOKEN ? this.tokenPriceE18 : 1_000_000_000_000_000_000n
  }
  async readAmountOut(_pool: Address, tokenIn: Address, amountIn: bigint, _blockNumber: bigint) {
    this.readBlocks.push(_blockNumber)
    this.quoteCalls += 1
    const gross = tokenIn === TOKEN
      ? (amountIn * this.tokenPriceE18) / 1_000_000_000_000_000_000n
      : (amountIn * 1_000_000_000_000_000_000n) / this.tokenPriceE18
    return (gross * 9_970n) / 10_000n
  }
  async readBalance(token: Address, _account: Address, _blockNumber: bigint) {
    this.readBlocks.push(_blockNumber)
    return this.balances.get(token) ?? 0n
  }
  async readDelegation(_vault: Address, _blockNumber: bigint) {
    this.readBlocks.push(_blockNumber)
    return { ...this.delegation, budgetSpent: this.budgetSpent }
  }
  async readPortfolioBaseline(_vault: Address, _blockNumber: bigint) {
    this.readBlocks.push(_blockNumber)
    return this.baseline
  }
  async readPendingDecision(_vault: Address, _blockNumber: bigint) {
    this.readBlocks.push(_blockNumber)
    return this.pending
  }
  async readPendingRequest(_vault: Address, _pending: typeof this.pending, _blockNumber: bigint) {
    return this.pendingRequest
  }
  async readNarrationCostRecorded(
    _vault: Address,
    _delegationId: bigint,
    _decisionId: DecisionId,
    _blockNumber: bigint,
  ) {
    return this.narrationRecorded
  }
}

class FakeWriter implements VaultWriter {
  executed: Parameters<VaultWriter['executeAuto']>[0][] = []
  proposed: Parameters<VaultWriter['propose']>[0][] = []
  expired: DecisionId[] = []
  failAuto = false
  costs: { amount: bigint; decisionId: DecisionId; kind: CostKind }[] = []
  notExecuted: Parameters<VaultWriter['recordNotExecuted']>[0][] = []

  async executeAuto(args: Parameters<VaultWriter['executeAuto']>[0]) {
    this.executed.push(args)
    if (this.failAuto) throw new Error('swap reverted')
    return '0xauto' as const
  }
  async propose(_args: Parameters<VaultWriter['propose']>[0]) {
    this.proposed.push(_args)
    return '0xpropose' as const
  }
  async chargeNarrationCost(args: Parameters<VaultWriter['chargeNarrationCost']>[0]) {
    this.costs.push({ amount: args.amount, decisionId: args.decisionId, kind: 'narration' })
    return '0xnarration' as const
  }
  async expire(args: Parameters<VaultWriter['expire']>[0]) {
    this.expired.push(args.decisionId)
    return '0xexpire' as const
  }
  async recordNotExecuted(args: Parameters<VaultWriter['recordNotExecuted']>[0]) {
    this.notExecuted.push(args)
    return '0xnot' as const
  }
}

/** 회계가 결제 수단을 모른다는 것을 보이기 위한 대체 구현 (R11.3). */
class StubAdapter implements PaymentAdapter {
  acquired: CostKind[] = []
  constructor(private readonly unit: bigint) {}
  async quote(_r: ResourceRef) {
    return this.unit
  }
  async acquire(resource: ResourceRef) {
    this.acquired.push(resource.kind)
    return { cost: this.unit }
  }
}

function config(over: Partial<KeeperConfig> = {}): KeeperConfig {
  return {
    vault: VAULT,
    maxAgeBlocks: 10n,
    gasValueEstimate: 1_000_000n,
    ...over,
  }
}

function disappointed(blockNumber: bigint): TrackRecord {
  return {
    kind: 'disappointed',
    delegationId: 1n,
    characterId: 'timid',
    reportId: `0x${blockNumber.toString(16).padStart(64, '0')}`,
    blockNumber,
  }
}

function build(opts: {
  costUnit?: bigint
  records?: TrackRecord[]
  cfg?: Partial<KeeperConfig>
  llm?: LlmClient
} = {}) {
  const chain = new FakeChain()
  const writer = new FakeWriter()
  const adapter = new StubAdapter(opts.costUnit ?? 1_000_000n) // 기본 $1
  const meter = new CostMeter(adapter)
  const keeper = new Keeper(chain, writer, meter, config(opts.cfg), async () => opts.records ?? [], opts.llm)
  return { chain, writer, adapter, meter, keeper }
}

describe('Keeper — 위임 상태', () => {
  it('철회된 위임에서는 아무것도 하지 않는다 (R3.5)', async () => {
    const { chain, keeper, writer } = build()
    chain.delegation = { ...chain.delegation, expiry: 0n }

    expect(await keeper.tick()).toEqual({ kind: 'inactive', reason: 'revoked' })
    expect(writer.executed).toHaveLength(0)
    expect(writer.costs).toHaveLength(0)
  })

  it('만료된 위임에서는 자동 실행이 멈춘다 (R3.4)', async () => {
    const { chain, keeper } = build()
    // 만료는 블록 번호가 아니라 체인 시각으로 잰다 — 볼트와 같은 단위다.
    chain.timestamp = 3_000_000n

    expect(await keeper.tick()).toEqual({ kind: 'inactive', reason: 'expired' })
  })

  it('전략 해시나 공식 버전이 다르면 유료 호출 전에 중단한다', async () => {
    const { chain, keeper, adapter } = build()
    chain.delegation = { ...chain.delegation, trustFormulaVersion: 2 }

    expect(await keeper.tick()).toEqual({ kind: 'inactive', reason: 'unsupported_delegation' })
    expect(adapter.acquired).toHaveLength(0)

    const second = build()
    second.chain.delegation = { ...second.chain.delegation, strategyHash: `0x${'00'.repeat(32)}` }
    expect(await second.keeper.tick()).toEqual({ kind: 'inactive', reason: 'unsupported_delegation' })
    expect(second.adapter.acquired).toHaveLength(0)
  })

  it('모든 상태와 가격을 한 블록에 고정해 읽는다', async () => {
    const { chain, keeper } = build()
    await keeper.tick()
    expect(new Set(chain.readBlocks)).toEqual(new Set([chain.block]))
  })
})

describe('Keeper — 비용 판단이 먼저다 (R4.7)', () => {
  it('데이터 값이 교정 이득을 넘으면 사기 전에 멈춘다', async () => {
    // 첫 tick으로 스냅샷을 만들어 두면 다음 tick에서 사전 판단이 가능해진다.
    const { keeper, adapter, writer } = build({ costUnit: 1_000_000n })
    await keeper.tick()

    const before = adapter.acquired.length
    const costsBefore = writer.costs.length

    // 데이터 값을 교정 가능액보다 크게 만든다.
    // 포트폴리오 $10,000 × 밴드 3% = 약 $300이 상한.
    ;(adapter as unknown as { unit: bigint }).unit = 400_000_000n // $400

    const r = await keeper.tick()
    expect(r).toEqual({ kind: 'skipped', reason: 'cost_exceeds_benefit' })
    // 지출이 늘지 않았다 — 사기 전에 멈췄다는 뜻이다.
    expect(adapter.acquired.length).toBe(before)
    expect(writer.costs.length).toBe(costsBefore)
  })

  it('예산이 모자라면 유료 호출을 하지 않는다 (R11.2)', async () => {
    const { chain, keeper, adapter } = build({ costUnit: 1_000_000n })
    chain.budgetSpent = chain.delegation.budget // 전액 소진

    const r = await keeper.tick()
    expect(r).toEqual({ kind: 'skipped', reason: 'budget_exhausted' })
    expect(adapter.acquired).toHaveLength(0)
  })

  it('운영비 한도가 소진돼도 유료 호출을 하지 않는다', async () => {
    const { chain, keeper, adapter } = build()
    chain.delegation = {
      ...chain.delegation,
      operatingSpent: chain.delegation.operatingCap,
    }

    expect(await keeper.tick()).toEqual({ kind: 'skipped', reason: 'budget_exhausted' })
    expect(adapter.acquired).toHaveLength(0)
  })
})

describe('Keeper — 자동 실행과 승인 요청', () => {
  it('임계값 안이면 알아서 실행하고 비용을 판단에 붙인다 (R5.1, R11.5)', async () => {
    // 가격이 올라 이탈 429bp — timid(300bp)를 넘는다.
    const { chain, keeper, writer, adapter } = build()
    chain.tokenPriceE18 = 2_400_000_000n

    const r = await keeper.tick()
    expect(r.kind).toBe('executed')
    expect(writer.executed).toHaveLength(1)
    expect(writer.executed[0]).toMatchObject({ delegationId: 1n, stateNonce: 0n, priceCost: 1_000_000n })
    expect(chain.quoteCalls).toBe(1)

    // 비용이 그 판단 ID에 귀속된다 — 어떤 판단에 얼마를 썼는지가 남는다.
    if (r.kind === 'executed') {
      expect(adapter.acquired).toContain('price_data')
    }
  })

  it('신뢰가 낮으면 같은 거래를 멈추고 물어본다 (R5.2)', async () => {
    // 실망 기록으로 신뢰를 떨어뜨려 재량을 좁힌다.
    const records: TrackRecord[] = [
      disappointed(1n),
      disappointed(2n),
      disappointed(3n),
    ]
    const { chain, keeper, writer } = build({ records })
    chain.tokenPriceE18 = 2_400_000_000n

    const r = await keeper.tick()
    expect(r.kind).toBe('asked')
    expect(writer.executed).toHaveLength(0)
    expect(writer.proposed[0]).toMatchObject({ delegationId: 1n, stateNonce: 0n, priceCost: 1_000_000n })
    expect(keeper.status().pending).toBeDefined()
  })

  it('재시작 뒤에도 온체인 pending을 복원하고 만료시킨다 (R5.4)', async () => {
    const { chain, keeper, writer } = build()
    chain.pending = {
      delegationId: 1n,
      proposalNonce: 0n,
      decisionId: `0x${'ab'.repeat(32)}` as DecisionId,
      orderHash: `0x${'bc'.repeat(32)}` as DecisionId,
      evidenceHash: `0x${'cd'.repeat(32)}` as DecisionId,
      expiresAt: chain.timestamp + 10n,
      open: true,
    }
    chain.delegation = { ...chain.delegation, stateNonce: 1n }
    chain.pendingRequest = {
      blockNumber: chain.block,
      dex: POOL,
      trade: { tokenIn: TOKEN, tokenOut: USDC, amountIn: 1n, minAmountOut: 1n },
      evidence: { weights: [], driftBps: bps(400), bandBps: bps(300), outcome: 'asked' },
    }

    expect(await keeper.tick()).toMatchObject({ kind: 'awaiting_approval', decisionId: chain.pending.decisionId })
    expect(keeper.status()).toMatchObject({
      phase: 'awaiting_approval',
      delegationId: '1',
      pending: { decisionId: chain.pending.decisionId, dex: POOL },
    })
    chain.timestamp += 11n
    expect(await keeper.tick()).toMatchObject({ kind: 'skipped', reason: 'expired' })
    expect(writer.expired).toEqual([chain.pending.decisionId])
  })

  it('자동 실행 revert는 같은 판단과 비용으로 미실행 처리한다', async () => {
    const { chain, keeper, writer } = build()
    chain.tokenPriceE18 = 2_400_000_000n
    writer.failAuto = true

    const result = await keeper.tick()
    expect(result).toMatchObject({ kind: 'rejected', reason: 'swap reverted' })
    expect(writer.notExecuted).toHaveLength(1)
    expect(writer.notExecuted[0]).toMatchObject({
      decisionId: writer.executed[0]?.decisionId,
      delegationId: 1n,
      stateNonce: 0n,
      priceCost: 1_000_000n,
      reason: 8,
    })
  })
})

describe('Keeper — 실행되지 않은 판단도 남는다 (R7.4)', () => {
  it('밴드 안이면 무거래 판단이 기록된다', async () => {
    const { keeper, writer } = build()
    // 가격 그대로 → 60/40 유지 → 이탈 0
    const r = await keeper.tick()

    expect(r.kind).toBe('skipped')
    expect(writer.notExecuted).toHaveLength(1)
    expect(writer.notExecuted[0]).toMatchObject({ delegationId: 1n, stateNonce: 0n, priceCost: 1_000_000n })
    expect(writer.executed).toHaveLength(0)
  })

  it('기대 잔고와 실제 잔고가 다르면 판단을 중단한다', async () => {
    const { chain, keeper, writer, adapter } = build()
    chain.balances.set(TOKEN, (chain.balances.get(TOKEN) ?? 0n) + 1n)

    expect(await keeper.tick()).toEqual({ kind: 'inactive', reason: 'cashflow_unknown' })
    expect(writer.notExecuted).toHaveLength(0)
    expect(adapter.acquired).toHaveLength(0)
  })

  it('동시에 요청된 tick은 같은 실행 하나를 공유한다', async () => {
    const { chain, keeper, writer } = build()
    chain.tokenPriceE18 = 2_400_000_000n

    const first = keeper.tick()
    const second = keeper.tick()
    expect(first).toBe(second)
    expect(keeper.status().phase).toBe('deciding')
    await Promise.all([first, second])
    expect(writer.executed).toHaveLength(1)
  })
})

describe('Keeper — status와 Narrator', () => {
  it('판단을 기록한 뒤 비용을 한 번 연결하고 검증된 설명을 캐시한다', async () => {
    const llm: LlmClient = { complete: async () => '이번에는 그대로 뒀어요.' }
    const { keeper, writer, adapter } = build({ llm })

    await keeper.tick()

    expect(writer.costs).toHaveLength(1)
    expect(adapter.acquired).toEqual(['price_data', 'narration'])
    expect(keeper.status()).toMatchObject({
      phase: 'idle',
      delegationId: '1',
      lastDecision: { outcome: 'held' },
      narration: { text: '이번에는 그대로 뒀어요.', fallback: false },
      snapshot: { blockNumber: '100' },
      lossReport: { status: 'not_loss' },
    })
  })

  it('재시작 뒤 이미 과금된 판단은 LLM을 다시 부르지 않고 템플릿을 쓴다', async () => {
    let calls = 0
    const llm: LlmClient = {
      complete: async () => {
        calls += 1
        return '이번에는 그대로 뒀어요.'
      },
    }
    const built = build({ llm })
    built.chain.narrationRecorded = true

    await built.keeper.tick()

    expect(calls).toBe(0)
    expect(built.writer.costs).toHaveLength(0)
    expect(built.keeper.status().narration?.fallback).toBe(true)
  })

  it('재시작 시 온체인 근거로 상태를 읽기 전용 복원한다', async () => {
    const decisionId = `0x${'ef'.repeat(32)}` as DecisionId
    const evidence = { weights: [], driftBps: bps(0), bandBps: bps(300), outcome: 'held' as const }
    const records: TrackRecord[] = [
      {
        kind: 'decided',
        delegationId: 1n,
        decisionId,
        characterId: 'timid',
        trustFormulaVersion: 1,
        blockNumber: 90n,
        evidence,
      },
      {
        kind: 'not_executed',
        delegationId: 1n,
        decisionId,
        characterId: 'timid',
        trustFormulaVersion: 1,
        blockNumber: 90n,
        reason: 'within_band',
      },
      {
        kind: 'cost',
        delegationId: 1n,
        decisionId,
        characterId: 'timid',
        trustFormulaVersion: 1,
        blockNumber: 90n,
        amount: 3n,
        costKind: 'narration',
      },
    ]
    const built = build({ records })

    const status = await built.keeper.refreshStatus()

    expect(status).toMatchObject({
      phase: 'idle',
      lastDecision: { decisionId, outcome: 'held' },
      narration: { decisionId, fallback: true },
    })
    expect(built.writer.costs).toHaveLength(0)
    expect(built.adapter.acquired).toHaveLength(0)
  })

  it('승인 대기 설명을 owner 실행 뒤 완료 설명으로 바꾼다', async () => {
    const records: TrackRecord[] = [disappointed(1n), disappointed(2n), disappointed(3n)]
    const built = build({
      records,
      llm: { complete: async () => '확인을 받고 진행할게요.' },
    })
    built.chain.tokenPriceE18 = 2_400_000_000n
    await built.keeper.tick()
    const pending = built.keeper.status().pending
    if (!pending) throw new Error('pending missing')

    records.push(
      {
        kind: 'decided',
        delegationId: 1n,
        decisionId: pending.decisionId,
        characterId: 'timid',
        trustFormulaVersion: 1,
        blockNumber: 101n,
        evidence: pending.evidence,
      },
      {
        kind: 'executed',
        delegationId: 1n,
        decisionId: pending.decisionId,
        characterId: 'timid',
        trustFormulaVersion: 1,
        blockNumber: 102n,
        tokenIn: pending.trade.tokenIn,
        tokenOut: pending.trade.tokenOut,
        amountIn: pending.trade.amountIn,
        amountOut: pending.trade.minAmountOut,
        valueInQuote: 10n,
        valueOutQuote: 9n,
        frictionQuote: 1n,
      },
    )
    built.chain.balances.set(TOKEN, built.chain.balances.get(TOKEN)! - pending.trade.amountIn)
    built.chain.balances.set(USDC, built.chain.balances.get(USDC)! + pending.trade.minAmountOut)
    const refreshed = await built.keeper.refreshStatus()

    expect(refreshed.lastDecision?.outcome).toBe('executed')
    expect(refreshed.narration?.text).not.toBe('확인을 받고 진행할게요.')
    expect(refreshed.narration?.fallback).toBe(true)
  })
})

describe('CostMeter — 결제 수단과 분리 (R11.3)', () => {
  it('어댑터를 바꿔도 회계 로직은 그대로다', async () => {
    const a = new StubAdapter(5n)
    const meter = new CostMeter(a)

    await meter.acquire({ kind: 'price_data' }, 1_000n, 1_000n)
    await meter.acquire({ kind: 'narration' }, 1_000n, 1_000n)
    expect(meter.pendingTotal()).toBe(10n)
    expect(a.acquired).toEqual(['price_data', 'narration'])
    meter.discard()
    expect(meter.pendingTotal()).toBe(0n)
  })

  it('예산을 넘기면 쓰지 않는다', async () => {
    const meter = new CostMeter(new StubAdapter(600n))

    await meter.acquire({ kind: 'price_data' }, 1_000n, 1_000n)
    await expect(meter.acquire({ kind: 'price_data' }, 1_000n, 1_000n)).rejects.toThrow('예산이 소진')
  })

  it('고정 단가 어댑터도 같은 인터페이스로 취득한다', async () => {
    const adapter = new VaultBudgetAdapter({ price_data: 7n, narration: 3n })
    const meter = new CostMeter(adapter)

    await meter.acquire({ kind: 'price_data' }, 1_000n, 1_000n)
    await meter.acquire({ kind: 'narration' }, 1_000n, 1_000n)

    expect(meter.pendingTotal()).toBe(10n)
  })
})
