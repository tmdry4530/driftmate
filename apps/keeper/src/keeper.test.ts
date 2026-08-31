import { describe, expect, it } from 'vitest'
import type { Address, CostKind, DecisionId, TrackRecord } from '@soon/shared'
import { bps } from '@soon/engine'
import { Keeper, type KeeperConfig } from './keeper.js'
import { CostMeter, type PaymentAdapter, type ResourceRef } from './payment.js'
import { VaultBudgetAdapter } from './vaultBudgetAdapter.js'
import type { ChainReader, OnChainDelegation, VaultWriter } from './ports.js'

const TOKEN: Address = '0x1111111111111111111111111111111111111111'
const USDC: Address = '0x2222222222222222222222222222222222222222'
const POOL: Address = '0x3333333333333333333333333333333333333333'
const VAULT: Address = '0x4444444444444444444444444444444444444444'

/** 체인을 흉내내는 최소 구현. 실제 노드 없이 파이프라인 전체를 돌린다. */
class FakeChain implements ChainReader {
  block = 100n
  tokenPriceE18 = 2_000_000_000n
  balances = new Map<Address, bigint>([
    [TOKEN, 3_000_000_000_000_000_000n], // 3개 = $6000
    [USDC, 4_000_000_000n], //              $4000
  ])
  budgetSpent = 0n
  delegation: OnChainDelegation = {
    executor: '0x5555555555555555555555555555555555555555',
    quoteAsset: USDC,
    maxTradeValue: 1_000_000_000n, // $1000
    autoThreshold: 1_000_000_000n, // $1000
    budget: 5_000_000_000n,
    expiry: 2_000_000n, // 체인 시각(초) 기준
    allowedAssets: [TOKEN, USDC],
    allowedDexes: [POOL],
  }

  timestamp = 1_000_000n

  async getBlockNumber() {
    return this.block
  }
  async getBlockTimestamp() {
    return this.timestamp
  }
  async readSpotPriceE18(_pool: Address, asset: Address) {
    return asset === TOKEN ? this.tokenPriceE18 : 1_000_000_000_000_000_000n
  }
  async readBalance(token: Address, _account: Address) {
    return this.balances.get(token) ?? 0n
  }
  async readDelegation(_vault: Address) {
    return this.delegation
  }
  async readBudgetSpent(_vault: Address) {
    return this.budgetSpent
  }
}

class FakeWriter implements VaultWriter {
  executed: unknown[] = []
  costs: { amount: bigint; decisionId: DecisionId; kind: CostKind }[] = []
  notExecuted: { decisionId: DecisionId; reason: number }[] = []

  async execute(args: Parameters<VaultWriter['execute']>[0]) {
    this.executed.push(args)
    return '0xexec' as const
  }
  async chargeCost(args: Parameters<VaultWriter['chargeCost']>[0]) {
    this.costs.push({ amount: args.amount, decisionId: args.decisionId, kind: args.kind })
    return '0xcost' as const
  }
  async recordNotExecuted(args: Parameters<VaultWriter['recordNotExecuted']>[0]) {
    this.notExecuted.push({ decisionId: args.decisionId, reason: args.reason })
    return '0xnot' as const
  }
}

/** 회계가 결제 수단을 모른다는 것을 보이기 위한 대체 구현 (R11.3). */
class StubAdapter implements PaymentAdapter {
  settled: { amount: bigint; decisionId: DecisionId; kind: CostKind }[] = []
  constructor(private readonly unit: bigint) {}
  async quote(_r: ResourceRef) {
    return this.unit
  }
  async settle(amount: bigint, decisionId: DecisionId, kind: CostKind) {
    this.settled.push({ amount, decisionId, kind })
    return { amount, decisionId, kind }
  }
}

function config(over: Partial<KeeperConfig> = {}): KeeperConfig {
  return {
    vault: VAULT,
    pool: POOL,
    characterId: 'timid',
    target: {
      weights: [
        { asset: TOKEN, bps: bps(6_000) },
        { asset: USDC, bps: bps(4_000) },
      ],
    },
    assets: [TOKEN, USDC],
    slippageToleranceBps: bps(50),
    maxAgeBlocks: 10n,
    approvalTtlBlocks: 50n,
    gasValueEstimate: 1_000_000n,
    ...over,
  }
}

function build(opts: { costUnit?: bigint; records?: TrackRecord[]; cfg?: Partial<KeeperConfig> } = {}) {
  const chain = new FakeChain()
  const writer = new FakeWriter()
  const adapter = new StubAdapter(opts.costUnit ?? 1_000_000n) // 기본 $1
  const meter = new CostMeter(adapter, async () => chain.delegation.budget - chain.budgetSpent)
  const keeper = new Keeper(chain, writer, meter, config(opts.cfg), async () => opts.records ?? [])
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
})

describe('Keeper — 비용 판단이 먼저다 (R4.7)', () => {
  it('데이터 값이 교정 이득을 넘으면 사기 전에 멈춘다', async () => {
    // 첫 tick으로 스냅샷을 만들어 두면 다음 tick에서 사전 판단이 가능해진다.
    const { keeper, adapter, writer } = build({ costUnit: 1_000_000n })
    await keeper.tick()

    const before = adapter.settled.length
    const costsBefore = writer.costs.length

    // 데이터 값을 교정 가능액보다 크게 만든다.
    // 포트폴리오 $10,000 × 밴드 3% = 약 $300이 상한.
    ;(adapter as unknown as { unit: bigint }).unit = 400_000_000n // $400

    const r = await keeper.tick()
    expect(r).toEqual({ kind: 'skipped', reason: 'cost_exceeds_benefit' })
    // 지출이 늘지 않았다 — 사기 전에 멈췄다는 뜻이다.
    expect(adapter.settled.length).toBe(before)
    expect(writer.costs.length).toBe(costsBefore)
  })

  it('예산이 모자라면 유료 호출을 하지 않는다 (R11.2)', async () => {
    const { chain, keeper, adapter } = build({ costUnit: 1_000_000n })
    chain.budgetSpent = chain.delegation.budget // 전액 소진

    const r = await keeper.tick()
    expect(r).toEqual({ kind: 'skipped', reason: 'budget_exhausted' })
    expect(adapter.settled).toHaveLength(0)
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

    // 비용이 그 판단 ID에 귀속된다 — 어떤 판단에 얼마를 썼는지가 남는다.
    if (r.kind === 'executed') {
      expect(adapter.settled.length).toBeGreaterThan(0)
      expect(adapter.settled.every((c) => c.decisionId === r.decisionId)).toBe(true)
    }
  })

  it('신뢰가 낮으면 같은 거래를 멈추고 물어본다 (R5.2)', async () => {
    // 실망 기록으로 신뢰를 떨어뜨려 재량을 좁힌다.
    const records: TrackRecord[] = [
      { kind: 'disappointed', blockNumber: 1n },
      { kind: 'disappointed', blockNumber: 2n },
      { kind: 'disappointed', blockNumber: 3n },
    ]
    const { chain, keeper, writer } = build({ records })
    chain.tokenPriceE18 = 2_400_000_000n

    const r = await keeper.tick()
    expect(r.kind).toBe('asked')
    expect(writer.executed).toHaveLength(0)
    expect(keeper.pendingApprovals()).toHaveLength(1)
  })

  it('승인하면 그때 실행된다', async () => {
    const records: TrackRecord[] = [{ kind: 'disappointed', blockNumber: 1n }, { kind: 'disappointed', blockNumber: 2n }, { kind: 'disappointed', blockNumber: 3n }]
    const { chain, keeper, writer } = build({ records })
    chain.tokenPriceE18 = 2_400_000_000n

    const asked = await keeper.tick()
    if (asked.kind !== 'asked') throw new Error('expected asked')

    const done = await keeper.approve(asked.decisionId)
    expect(done.kind).toBe('executed')
    expect(writer.executed).toHaveLength(1)
    expect(keeper.pendingApprovals()).toHaveLength(0)
  })

  it('거절도 트랙레코드에 남는다 (R5.5)', async () => {
    const records: TrackRecord[] = [{ kind: 'disappointed', blockNumber: 1n }, { kind: 'disappointed', blockNumber: 2n }, { kind: 'disappointed', blockNumber: 3n }]
    const { chain, keeper, writer } = build({ records })
    chain.tokenPriceE18 = 2_400_000_000n

    const asked = await keeper.tick()
    if (asked.kind !== 'asked') throw new Error('expected asked')

    await keeper.reject(asked.decisionId)
    expect(writer.notExecuted).toContainEqual({ decisionId: asked.decisionId, reason: 0 })
    expect(writer.executed).toHaveLength(0)
  })

  it('답이 없는 요청은 만료되고 그 사실도 남는다 (R5.4)', async () => {
    const records: TrackRecord[] = [{ kind: 'disappointed', blockNumber: 1n }, { kind: 'disappointed', blockNumber: 2n }, { kind: 'disappointed', blockNumber: 3n }]
    const { chain, keeper, writer } = build({ records })
    chain.tokenPriceE18 = 2_400_000_000n

    const asked = await keeper.tick()
    if (asked.kind !== 'asked') throw new Error('expected asked')

    chain.block += 100n // TTL 50블록을 넘김
    await keeper.tick()

    expect(writer.notExecuted.some((n) => n.decisionId === asked.decisionId && n.reason === 1)).toBe(true)
    // 만료된 그 요청은 사라진다. 같은 tick이 새 판단으로 새 요청을 만드는 것은 정상이다.
    expect(keeper.pendingApprovals().some((p) => p.decision.id === asked.decisionId)).toBe(false)
  })
})

describe('Keeper — 실행되지 않은 판단도 남는다 (R7.4)', () => {
  it('밴드 안이면 무거래 판단이 기록된다', async () => {
    const { keeper, writer } = build()
    // 가격 그대로 → 60/40 유지 → 이탈 0
    const r = await keeper.tick()

    expect(r.kind).toBe('skipped')
    expect(writer.notExecuted).toHaveLength(1)
    expect(writer.executed).toHaveLength(0)
  })
})

describe('CostMeter — 결제 수단과 분리 (R11.3)', () => {
  it('어댑터를 바꿔도 회계 로직은 그대로다', async () => {
    const a = new StubAdapter(5n)
    const meter = new CostMeter(a, async () => 1_000n)

    await meter.charge({ kind: 'price_data' })
    await meter.charge({ kind: 'narration' })
    expect(meter.pendingTotal()).toBe(10n)

    const receipts = await meter.commit('0xdead' as DecisionId)
    expect(receipts).toHaveLength(2)
    expect(a.settled.map((s) => s.amount)).toEqual([5n, 5n])
    expect(a.settled.every((s) => s.decisionId === '0xdead')).toBe(true)
    expect(meter.pendingTotal()).toBe(0n)
  })

  it('예산을 넘기면 쓰지 않는다', async () => {
    const meter = new CostMeter(new StubAdapter(600n), async () => 1_000n)

    await meter.charge({ kind: 'price_data' })
    await expect(meter.charge({ kind: 'price_data' })).rejects.toThrow('예산이 소진')
  })

  it('볼트 어댑터는 같은 인터페이스로 체인에 기록한다', async () => {
    const writer = new FakeWriter()
    const adapter = new VaultBudgetAdapter(writer, VAULT, { price_data: 7n, narration: 3n })
    const meter = new CostMeter(adapter, async () => 1_000n)

    await meter.charge({ kind: 'price_data' })
    await meter.charge({ kind: 'narration' })
    await meter.commit('0xbeef' as DecisionId)

    // CostMeter는 바뀐 게 없고, 결제 구현만 갈아끼웠다 (R11.3).
    expect(writer.costs.map((c) => c.amount)).toEqual([7n, 3n])
    expect(writer.costs.every((c) => c.decisionId === '0xbeef')).toBe(true)
  })
})
