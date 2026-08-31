import type { CostKind, DecisionId } from '@soon/shared'

export type ResourceRef = Readonly<{ kind: CostKind }>

export type CostReceipt = Readonly<{
  amount: bigint
  decisionId: DecisionId
  kind: CostKind
  reference?: string
}>

/**
 * 결제 수단 경계 (R11.3, ADR-0004).
 *
 * 회계는 이 인터페이스 뒤에서 무슨 일이 일어나는지 모른다. 지금 구현체는 볼트 예산을
 * 차감할 뿐이고, x402 어댑터를 나중에 같은 자리에 끼워도 CostMeter는 그대로다.
 */
export interface PaymentAdapter {
  quote(resource: ResourceRef): Promise<bigint>
  settle(amount: bigint, decisionId: DecisionId, kind: CostKind): Promise<CostReceipt>
}

export class BudgetExhaustedError extends Error {
  constructor() {
    super('운영비 예산이 소진되었다')
    this.name = 'BudgetExhaustedError'
  }
}

type Pending = { amount: bigint; kind: CostKind }

/**
 * 운영비 회계 (R11.1, R11.5).
 *
 * 비용은 판단보다 먼저 발생하는데(가격을 사야 판단할 수 있다) 판단 ID는 나중에 나온다.
 * 그래서 발생 시점에는 보류해 두고, 판단이 확정되면 그 ID로 귀속시킨다.
 * 이렇게 해야 "어떤 판단에 얼마를 썼는지"가 기록에 남는다.
 */
export class CostMeter {
  private pending: Pending[] = []

  constructor(
    private readonly adapter: PaymentAdapter,
    private readonly budgetRemaining: () => Promise<bigint>,
  ) {}

  /** 견적만 본다. 지출하지 않는다 — 살지 말지 판단하는 데 쓴다 (R4.7). */
  async quote(resource: ResourceRef): Promise<bigint> {
    return this.adapter.quote(resource)
  }

  /**
   * 자원을 쓰고 비용을 보류 목록에 올린다.
   * 예산이 모자라면 쓰지 않고 중단한다 — 예산 밖에서 임의로 진행하지 않는다 (R11.2).
   */
  async charge(resource: ResourceRef): Promise<bigint> {
    const amount = await this.adapter.quote(resource)
    const remaining = await this.budgetRemaining()
    if (this.pendingTotal() + amount > remaining) {
      throw new BudgetExhaustedError()
    }
    this.pending.push({ amount, kind: resource.kind })
    return amount
  }

  /** 이번 판단에 지금까지 든 비용. decide()의 costEstimate에 들어간다. */
  pendingTotal(): bigint {
    return this.pending.reduce((acc, p) => acc + p.amount, 0n)
  }

  /** 판단이 확정되면 보류분을 그 판단에 귀속시킨다 (R11.5). */
  async commit(decisionId: DecisionId): Promise<CostReceipt[]> {
    const receipts: CostReceipt[] = []
    for (const p of this.pending) {
      receipts.push(await this.adapter.settle(p.amount, decisionId, p.kind))
    }
    this.pending = []
    return receipts
  }

  /** 판단에 이르지 못한 경우 보류분을 버린다. 지불하지 않은 것은 기록하지 않는다. */
  discard(): void {
    this.pending = []
  }
}
