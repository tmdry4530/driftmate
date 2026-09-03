import type { CostKind } from '@soon/shared'
import type { AcquiredResource, PaymentAdapter, ResourceRef } from './payment.js'

/** 자원별 단가. 실제 결제를 붙이면 공급자가 부르는 값으로 대체된다. */
export type PriceTable = Readonly<Record<CostKind, bigint>>

/**
 * 이번 범위의 결제 구현체. 실제 외부 결제 없이 고정 단가의 검증 데이터를 취득한다.
 * 비용 차감과 기록은 Keeper가 판단 종결 트랜잭션에 포함한다.
 */
export class VaultBudgetAdapter implements PaymentAdapter {
  constructor(private readonly prices: PriceTable) {}

  async quote(resource: ResourceRef): Promise<bigint> {
    return this.prices[resource.kind]
  }

  async acquire(resource: ResourceRef): Promise<AcquiredResource> {
    return { cost: this.prices[resource.kind] }
  }
}
