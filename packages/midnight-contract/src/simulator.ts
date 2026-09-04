import {
  CostModel,
  QueryContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime'

import {
  Contract,
  ledger,
  type Ledger,
} from '../managed/character-mandate/contract/index.js'
import { createPrivateState, type CharacterMandatePrivateState, witnesses } from './witnesses.js'

export type OpenRelationshipInput = Readonly<{
  characterId: bigint
  targetWeightBps: bigint
  allowedDriftBps: bigint
  autoThreshold: bigint
  budget: bigint
  expiry: bigint
  nonce: Uint8Array
  relationshipNonce: Uint8Array
}>

export type DecisionProofInput = Readonly<{
  decisionId: Uint8Array
  characterId: bigint
  targetWeightBps: bigint
  allowedDriftBps: bigint
  autoThreshold: bigint
  budget: bigint
  expiry: bigint
  mandateNonce: Uint8Array
  spent: bigint
  trustScore: bigint
  historyDigest: Uint8Array
  relationshipNonce: Uint8Array
  currentTimestamp: bigint
  valueA: bigint
  valueB: bigint
  currentWeightA: bigint
  currentWeightARemainder: bigint
  currentWeightB: bigint
  currentWeightBRemainder: bigint
  targetValueA: bigint
  targetValueARemainder: bigint
  targetValueB: bigint
  targetValueBRemainder: bigint
  effectiveCap: bigint
  effectiveCapRemainder: bigint
  totalCost: bigint
}>

export type RelationshipEventInput = Readonly<{
  decisionId: Uint8Array
  eventKind: bigint
  oldSpent: bigint
  oldTrustScore: bigint
  oldHistoryDigest: Uint8Array
  relationshipNonce: Uint8Array
  valueQuote: bigint
  frictionQuote: bigint
  operatingCost: bigint
  sourceDigest: Uint8Array
}>

export class CharacterMandateSimulator {
  readonly contract = new Contract<CharacterMandatePrivateState>(witnesses)
  private context: CircuitContext<CharacterMandatePrivateState>

  constructor(ownerSecret: Uint8Array) {
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(createConstructorContext(createPrivateState(ownerSecret), '0'.repeat(64)))
    this.context = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(currentContractState.data, sampleContractAddress()),
    }
  }

  getLedger(): Ledger {
    return ledger(this.context.currentQueryContext.state)
  }

  switchOwner(ownerSecret: Uint8Array): void {
    this.context.currentPrivateState = createPrivateState(ownerSecret)
  }

  open(input: OpenRelationshipInput): Ledger {
    this.context = this.contract.impureCircuits.openRelationship(
      this.context,
      input.characterId,
      input.targetWeightBps,
      input.allowedDriftBps,
      input.autoThreshold,
      input.budget,
      input.expiry,
      input.nonce,
      input.relationshipNonce,
    ).context
    return this.getLedger()
  }

  prove(input: DecisionProofInput): Ledger {
    this.context = this.contract.impureCircuits.proveDecision(
      this.context,
      input.decisionId,
      input.characterId,
      input.targetWeightBps,
      input.allowedDriftBps,
      input.autoThreshold,
      input.budget,
      input.expiry,
      input.mandateNonce,
      input.spent,
      input.trustScore,
      input.historyDigest,
      input.relationshipNonce,
      input.currentTimestamp,
      input.valueA,
      input.valueB,
      input.currentWeightA,
      input.currentWeightARemainder,
      input.currentWeightB,
      input.currentWeightBRemainder,
      input.targetValueA,
      input.targetValueARemainder,
      input.targetValueB,
      input.targetValueBRemainder,
      input.effectiveCap,
      input.effectiveCapRemainder,
      input.totalCost,
    ).context
    return this.getLedger()
  }

  resolve(decisionId: Uint8Array, approved: boolean): Ledger {
    this.context = this.contract.impureCircuits.resolvePending(
      this.context,
      decisionId,
      approved,
    ).context
    return this.getLedger()
  }

  recordEvent(input: RelationshipEventInput): Ledger {
    this.context = this.contract.impureCircuits.recordRelationshipEvent(
      this.context,
      input.decisionId,
      input.eventKind,
      input.oldSpent,
      input.oldTrustScore,
      input.oldHistoryDigest,
      input.relationshipNonce,
      input.valueQuote,
      input.frictionQuote,
      input.operatingCost,
      input.sourceDigest,
    ).context
    return this.getLedger()
  }

  revoke(): Ledger {
    this.context = this.contract.impureCircuits.revokeRelationship(this.context).context
    return this.getLedger()
  }
}
