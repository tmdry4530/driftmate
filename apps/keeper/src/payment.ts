import type { CostKind } from '@soon/shared'

export type ResourceRef = Readonly<{ kind: CostKind }>

export type CostReceipt = Readonly<{
  amount: bigint
  kind: CostKind
  reference?: string
}>

export type AcquiredResource = Readonly<{
  cost: bigint
  receipt?: string
}>

/**
 * 결제 수단 경계 (R11.3, ADR-0004).
 *
 * 회계는 이 인터페이스 뒤에서 무슨 일이 일어나는지 모른다. 지금 구현체는 고정 단가의
 * 검증 데이터를 돌려주고, x402를 붙여도 CostMeter는 그대로다.
 */
export interface PaymentAdapter {
  quote(resource: ResourceRef): Promise<bigint>
  acquire(resource: ResourceRef): Promise<AcquiredResource>
}

export class BudgetExhaustedError extends Error {
  constructor() {
    super('The operating-cost budget is exhausted.')
    this.name = 'BudgetExhaustedError'
  }
}

/**
 * 운영비 회계 (R11.1, R11.5).
 *
 * 판단 전에 취득한 자원의 비용을 현재 tick에만 보류한다. Keeper는 이 합계를
 * execute/propose/not-executed 호출에 넣어 판단과 같은 트랜잭션으로 기록한다.
 */
export class CostMeter {
  private pending: CostReceipt[] = []

  constructor(private readonly adapter: PaymentAdapter) {}

  /** 견적만 본다. 지출하지 않는다 — 살지 말지 판단하는 데 쓴다 (R4.7). */
  async quote(resource: ResourceRef): Promise<bigint> {
    return this.adapter.quote(resource)
  }

  /**
   * 자원을 쓰고 비용을 보류 목록에 올린다.
   * 예산이 모자라면 쓰지 않고 중단한다 — 예산 밖에서 임의로 진행하지 않는다 (R11.2).
   */
  async acquire(resource: ResourceRef, budgetRemaining: bigint, operatingRemaining: bigint): Promise<CostReceipt> {
    const quoted = await this.adapter.quote(resource)
    if (this.pendingTotal() + quoted > budgetRemaining || this.pendingTotal() + quoted > operatingRemaining) {
      throw new BudgetExhaustedError()
    }
    const acquired = await this.adapter.acquire(resource)
    if (acquired.cost > quoted || this.pendingTotal() + acquired.cost > budgetRemaining || this.pendingTotal() + acquired.cost > operatingRemaining) {
      throw new BudgetExhaustedError()
    }
    const receipt = { amount: acquired.cost, kind: resource.kind, ...(acquired.receipt ? { reference: acquired.receipt } : {}) }
    this.pending.push(receipt)
    return receipt
  }

  /** 이번 판단에 지금까지 든 비용. decide()의 costEstimate에 들어간다. */
  pendingTotal(): bigint {
    return this.pending.reduce((acc, p) => acc + p.amount, 0n)
  }

  /** 판단에 이르지 못한 경우 보류분을 버린다. 지불하지 않은 것은 기록하지 않는다. */
  discard(): void {
    this.pending = []
  }
}
