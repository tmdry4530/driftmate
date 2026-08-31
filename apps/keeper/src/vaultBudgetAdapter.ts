import type { Address, CostKind, DecisionId } from '@soon/shared'
import type { CostReceipt, PaymentAdapter, ResourceRef } from './payment.js'
import type { VaultWriter } from './ports.js'

/** 자원별 단가. 실제 결제를 붙이면 공급자가 부르는 값으로 대체된다. */
export type PriceTable = Readonly<Record<CostKind, bigint>>

/**
 * 이번 범위의 결제 구현체 — 볼트 예산에서 차감한다 (ADR-0004).
 *
 * 실제 자금 이동은 하지 않는다. 볼트의 chargeCost는 예산 회계와 기록만 담당하고,
 * 지불 자체는 x402 어댑터를 붙이는 단계의 몫이다.
 */
export class VaultBudgetAdapter implements PaymentAdapter {
  constructor(
    private readonly writer: VaultWriter,
    private readonly vault: Address,
    private readonly prices: PriceTable,
  ) {}

  async quote(resource: ResourceRef): Promise<bigint> {
    return this.prices[resource.kind]
  }

  async settle(amount: bigint, decisionId: DecisionId, kind: CostKind): Promise<CostReceipt> {
    const tx = await this.writer.chargeCost({ vault: this.vault, amount, decisionId, kind })
    return { amount, decisionId, kind, reference: tx }
  }
}
