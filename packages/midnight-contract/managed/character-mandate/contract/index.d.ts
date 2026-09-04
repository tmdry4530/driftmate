import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum ReceiptStatus { NONE = 0,
                            RELATIONSHIP_OPENED = 1,
                            RELATIONSHIP_REVOKED = 2,
                            HELD = 3,
                            PROVED_AUTO_ELIGIBLE = 4,
                            OWNER_REQUIRED = 5,
                            OWNER_APPROVED = 6,
                            OWNER_REJECTED = 7,
                            RELATIONSHIP_UPDATED = 8
}

export type Receipt = { decisionId: Uint8Array;
                        status: ReceiptStatus;
                        catalogVersion: bigint;
                        trustFormulaVersion: bigint;
                        circuitVersion: bigint;
                        sequence: bigint
                      };

export type Witnesses<PS> = {
  localOwnerSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  openRelationship(context: __compactRuntime.CircuitContext<PS>,
                   characterId_0: bigint,
                   targetWeightBps_0: bigint,
                   allowedDriftBps_0: bigint,
                   autoThreshold_0: bigint,
                   budget_0: bigint,
                   expiry_0: bigint,
                   nonce_0: Uint8Array,
                   relationshipNonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveDecision(context: __compactRuntime.CircuitContext<PS>,
                decisionId_0: Uint8Array,
                characterId_0: bigint,
                targetWeightBps_0: bigint,
                allowedDriftBps_0: bigint,
                autoThreshold_0: bigint,
                budget_0: bigint,
                expiry_0: bigint,
                mandateNonce_0: Uint8Array,
                spent_0: bigint,
                trustScore_0: bigint,
                historyDigest_0: Uint8Array,
                relationshipNonce_0: Uint8Array,
                currentTimestamp_0: bigint,
                valueA_0: bigint,
                valueB_0: bigint,
                currentWeightA_0: bigint,
                currentWeightARemainder_0: bigint,
                currentWeightB_0: bigint,
                currentWeightBRemainder_0: bigint,
                targetValueA_0: bigint,
                targetValueARemainder_0: bigint,
                targetValueB_0: bigint,
                targetValueBRemainder_0: bigint,
                effectiveCap_0: bigint,
                effectiveCapRemainder_0: bigint,
                totalCost_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  resolvePending(context: __compactRuntime.CircuitContext<PS>,
                 decisionId_0: Uint8Array,
                 approved_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  recordRelationshipEvent(context: __compactRuntime.CircuitContext<PS>,
                          decisionId_0: Uint8Array,
                          eventKind_0: bigint,
                          oldSpent_0: bigint,
                          oldTrustScore_0: bigint,
                          oldHistoryDigest_0: Uint8Array,
                          relationshipNonce_0: Uint8Array,
                          valueQuote_0: bigint,
                          frictionQuote_0: bigint,
                          operatingCost_0: bigint,
                          sourceDigest_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeRelationship(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  openRelationship(context: __compactRuntime.CircuitContext<PS>,
                   characterId_0: bigint,
                   targetWeightBps_0: bigint,
                   allowedDriftBps_0: bigint,
                   autoThreshold_0: bigint,
                   budget_0: bigint,
                   expiry_0: bigint,
                   nonce_0: Uint8Array,
                   relationshipNonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveDecision(context: __compactRuntime.CircuitContext<PS>,
                decisionId_0: Uint8Array,
                characterId_0: bigint,
                targetWeightBps_0: bigint,
                allowedDriftBps_0: bigint,
                autoThreshold_0: bigint,
                budget_0: bigint,
                expiry_0: bigint,
                mandateNonce_0: Uint8Array,
                spent_0: bigint,
                trustScore_0: bigint,
                historyDigest_0: Uint8Array,
                relationshipNonce_0: Uint8Array,
                currentTimestamp_0: bigint,
                valueA_0: bigint,
                valueB_0: bigint,
                currentWeightA_0: bigint,
                currentWeightARemainder_0: bigint,
                currentWeightB_0: bigint,
                currentWeightBRemainder_0: bigint,
                targetValueA_0: bigint,
                targetValueARemainder_0: bigint,
                targetValueB_0: bigint,
                targetValueBRemainder_0: bigint,
                effectiveCap_0: bigint,
                effectiveCapRemainder_0: bigint,
                totalCost_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  resolvePending(context: __compactRuntime.CircuitContext<PS>,
                 decisionId_0: Uint8Array,
                 approved_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  recordRelationshipEvent(context: __compactRuntime.CircuitContext<PS>,
                          decisionId_0: Uint8Array,
                          eventKind_0: bigint,
                          oldSpent_0: bigint,
                          oldTrustScore_0: bigint,
                          oldHistoryDigest_0: Uint8Array,
                          relationshipNonce_0: Uint8Array,
                          valueQuote_0: bigint,
                          frictionQuote_0: bigint,
                          operatingCost_0: bigint,
                          sourceDigest_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeRelationship(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  computeOwnerCommitment(ownerSecret_0: Uint8Array, version_0: bigint): Uint8Array;
  computeMandateCommitment(characterId_0: bigint,
                           targetWeightBps_0: bigint,
                           allowedDriftBps_0: bigint,
                           autoThreshold_0: bigint,
                           budget_0: bigint,
                           expiry_0: bigint,
                           nonce_0: Uint8Array,
                           version_0: bigint): Uint8Array;
  computeRelationshipCommitment(ownerHash_0: Uint8Array,
                                mandateHash_0: Uint8Array,
                                spent_0: bigint,
                                trustScore_0: bigint,
                                historyDigest_0: Uint8Array,
                                relationshipNonce_0: Uint8Array,
                                version_0: bigint): Uint8Array;
  computeHistoryAfter(previous_0: Uint8Array,
                      decisionId_0: Uint8Array,
                      eventKind_0: bigint,
                      sourceDigest_0: Uint8Array,
                      newTrustScore_0: bigint,
                      newSpent_0: bigint): Uint8Array;
  computeTrustAfterEvent(oldTrustScore_0: bigint,
                         eventKind_0: bigint,
                         valueQuote_0: bigint,
                         frictionQuote_0: bigint,
                         operatingCost_0: bigint): bigint;
}

export type Circuits<PS> = {
  computeOwnerCommitment(context: __compactRuntime.CircuitContext<PS>,
                         ownerSecret_0: Uint8Array,
                         version_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  computeMandateCommitment(context: __compactRuntime.CircuitContext<PS>,
                           characterId_0: bigint,
                           targetWeightBps_0: bigint,
                           allowedDriftBps_0: bigint,
                           autoThreshold_0: bigint,
                           budget_0: bigint,
                           expiry_0: bigint,
                           nonce_0: Uint8Array,
                           version_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  computeRelationshipCommitment(context: __compactRuntime.CircuitContext<PS>,
                                ownerHash_0: Uint8Array,
                                mandateHash_0: Uint8Array,
                                spent_0: bigint,
                                trustScore_0: bigint,
                                historyDigest_0: Uint8Array,
                                relationshipNonce_0: Uint8Array,
                                version_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  computeHistoryAfter(context: __compactRuntime.CircuitContext<PS>,
                      previous_0: Uint8Array,
                      decisionId_0: Uint8Array,
                      eventKind_0: bigint,
                      sourceDigest_0: Uint8Array,
                      newTrustScore_0: bigint,
                      newSpent_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  computeTrustAfterEvent(context: __compactRuntime.CircuitContext<PS>,
                         oldTrustScore_0: bigint,
                         eventKind_0: bigint,
                         valueQuote_0: bigint,
                         frictionQuote_0: bigint,
                         operatingCost_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  openRelationship(context: __compactRuntime.CircuitContext<PS>,
                   characterId_0: bigint,
                   targetWeightBps_0: bigint,
                   allowedDriftBps_0: bigint,
                   autoThreshold_0: bigint,
                   budget_0: bigint,
                   expiry_0: bigint,
                   nonce_0: Uint8Array,
                   relationshipNonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  proveDecision(context: __compactRuntime.CircuitContext<PS>,
                decisionId_0: Uint8Array,
                characterId_0: bigint,
                targetWeightBps_0: bigint,
                allowedDriftBps_0: bigint,
                autoThreshold_0: bigint,
                budget_0: bigint,
                expiry_0: bigint,
                mandateNonce_0: Uint8Array,
                spent_0: bigint,
                trustScore_0: bigint,
                historyDigest_0: Uint8Array,
                relationshipNonce_0: Uint8Array,
                currentTimestamp_0: bigint,
                valueA_0: bigint,
                valueB_0: bigint,
                currentWeightA_0: bigint,
                currentWeightARemainder_0: bigint,
                currentWeightB_0: bigint,
                currentWeightBRemainder_0: bigint,
                targetValueA_0: bigint,
                targetValueARemainder_0: bigint,
                targetValueB_0: bigint,
                targetValueBRemainder_0: bigint,
                effectiveCap_0: bigint,
                effectiveCapRemainder_0: bigint,
                totalCost_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  resolvePending(context: __compactRuntime.CircuitContext<PS>,
                 decisionId_0: Uint8Array,
                 approved_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  recordRelationshipEvent(context: __compactRuntime.CircuitContext<PS>,
                          decisionId_0: Uint8Array,
                          eventKind_0: bigint,
                          oldSpent_0: bigint,
                          oldTrustScore_0: bigint,
                          oldHistoryDigest_0: Uint8Array,
                          relationshipNonce_0: Uint8Array,
                          valueQuote_0: bigint,
                          frictionQuote_0: bigint,
                          operatingCost_0: bigint,
                          sourceDigest_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  revokeRelationship(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly ownerCommitment: Uint8Array;
  readonly mandateCommitment: Uint8Array;
  readonly relationshipCommitment: Uint8Array;
  readonly mandateVersion: bigint;
  readonly active: boolean;
  usedDecisionIds: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly pendingDecisionId: { is_some: boolean, value: Uint8Array };
  readonly receiptSequence: bigint;
  readonly lastReceipt: Receipt;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
