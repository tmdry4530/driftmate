import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

export var ReceiptStatus;
(function (ReceiptStatus) {
  ReceiptStatus[ReceiptStatus['NONE'] = 0] = 'NONE';
  ReceiptStatus[ReceiptStatus['RELATIONSHIP_OPENED'] = 1] = 'RELATIONSHIP_OPENED';
  ReceiptStatus[ReceiptStatus['RELATIONSHIP_REVOKED'] = 2] = 'RELATIONSHIP_REVOKED';
  ReceiptStatus[ReceiptStatus['HELD'] = 3] = 'HELD';
  ReceiptStatus[ReceiptStatus['PROVED_AUTO_ELIGIBLE'] = 4] = 'PROVED_AUTO_ELIGIBLE';
  ReceiptStatus[ReceiptStatus['OWNER_REQUIRED'] = 5] = 'OWNER_REQUIRED';
  ReceiptStatus[ReceiptStatus['OWNER_APPROVED'] = 6] = 'OWNER_APPROVED';
  ReceiptStatus[ReceiptStatus['OWNER_REJECTED'] = 7] = 'OWNER_REJECTED';
  ReceiptStatus[ReceiptStatus['RELATIONSHIP_UPDATED'] = 8] = 'RELATIONSHIP_UPDATED';
})(ReceiptStatus || (ReceiptStatus = {}));

const _descriptor_0 = __compactRuntime.CompactTypeBoolean;

const _descriptor_1 = new __compactRuntime.CompactTypeBytes(32);

class _Maybe_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_1.alignment());
  }
  fromValue(value_0) {
    return {
      is_some: _descriptor_0.fromValue(value_0),
      value: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.is_some).concat(_descriptor_1.toValue(value_0.value));
  }
}

const _descriptor_2 = new _Maybe_0();

const _descriptor_3 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

const _descriptor_4 = new __compactRuntime.CompactTypeEnum(8, 1);

const _descriptor_5 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

class _Receipt_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_4.alignment().concat(_descriptor_3.alignment().concat(_descriptor_3.alignment().concat(_descriptor_3.alignment().concat(_descriptor_5.alignment())))));
  }
  fromValue(value_0) {
    return {
      decisionId: _descriptor_1.fromValue(value_0),
      status: _descriptor_4.fromValue(value_0),
      catalogVersion: _descriptor_3.fromValue(value_0),
      trustFormulaVersion: _descriptor_3.fromValue(value_0),
      circuitVersion: _descriptor_3.fromValue(value_0),
      sequence: _descriptor_5.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.decisionId).concat(_descriptor_4.toValue(value_0.status).concat(_descriptor_3.toValue(value_0.catalogVersion).concat(_descriptor_3.toValue(value_0.trustFormulaVersion).concat(_descriptor_3.toValue(value_0.circuitVersion).concat(_descriptor_5.toValue(value_0.sequence))))));
  }
}

const _descriptor_6 = new _Receipt_0();

const _descriptor_7 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

const _descriptor_8 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

const _descriptor_9 = new __compactRuntime.CompactTypeVector(4, _descriptor_1);

const _descriptor_10 = new __compactRuntime.CompactTypeVector(7, _descriptor_1);

const _descriptor_11 = new __compactRuntime.CompactTypeVector(3, _descriptor_1);

const _descriptor_12 = new __compactRuntime.CompactTypeVector(9, _descriptor_1);

const _descriptor_13 = new __compactRuntime.CompactTypeVector(8, _descriptor_1);

class _Either_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_0.fromValue(value_0),
      left: _descriptor_1.fromValue(value_0),
      right: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.is_left).concat(_descriptor_1.toValue(value_0.left).concat(_descriptor_1.toValue(value_0.right)));
  }
}

const _descriptor_14 = new _Either_0();

class _ContractAddress_0 {
  alignment() {
    return _descriptor_1.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.bytes);
  }
}

const _descriptor_15 = new _ContractAddress_0();

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.localOwnerSecret) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named localOwnerSecret');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      computeOwnerCommitment(context, ...args_1) {
        return { result: pureCircuits.computeOwnerCommitment(...args_1), context };
      },
      computeMandateCommitment(context, ...args_1) {
        return { result: pureCircuits.computeMandateCommitment(...args_1), context };
      },
      computeRelationshipCommitment(context, ...args_1) {
        return { result: pureCircuits.computeRelationshipCommitment(...args_1), context };
      },
      computeHistoryAfter(context, ...args_1) {
        return { result: pureCircuits.computeHistoryAfter(...args_1), context };
      },
      computeTrustAfterEvent(context, ...args_1) {
        return { result: pureCircuits.computeTrustAfterEvent(...args_1), context };
      },
      openRelationship: (...args_1) => {
        if (args_1.length !== 9) {
          throw new __compactRuntime.CompactError(`openRelationship: expected 9 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const characterId_0 = args_1[1];
        const targetWeightBps_0 = args_1[2];
        const allowedDriftBps_0 = args_1[3];
        const autoThreshold_0 = args_1[4];
        const budget_0 = args_1[5];
        const expiry_0 = args_1[6];
        const nonce_0 = args_1[7];
        const relationshipNonce_0 = args_1[8];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('openRelationship',
                                     'argument 1 (as invoked from Typescript)',
                                     'CharacterMandate.compact line 319 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(characterId_0) === 'bigint' && characterId_0 >= 0n && characterId_0 <= 255n)) {
          __compactRuntime.typeError('openRelationship',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'CharacterMandate.compact line 319 char 1',
                                     'Uint<0..256>',
                                     characterId_0)
        }
        if (!(typeof(targetWeightBps_0) === 'bigint' && targetWeightBps_0 >= 0n && targetWeightBps_0 <= 65535n)) {
          __compactRuntime.typeError('openRelationship',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'CharacterMandate.compact line 319 char 1',
                                     'Uint<0..65536>',
                                     targetWeightBps_0)
        }
        if (!(typeof(allowedDriftBps_0) === 'bigint' && allowedDriftBps_0 >= 0n && allowedDriftBps_0 <= 65535n)) {
          __compactRuntime.typeError('openRelationship',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'CharacterMandate.compact line 319 char 1',
                                     'Uint<0..65536>',
                                     allowedDriftBps_0)
        }
        if (!(typeof(autoThreshold_0) === 'bigint' && autoThreshold_0 >= 0n && autoThreshold_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('openRelationship',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'CharacterMandate.compact line 319 char 1',
                                     'Uint<0..18446744073709551616>',
                                     autoThreshold_0)
        }
        if (!(typeof(budget_0) === 'bigint' && budget_0 >= 0n && budget_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('openRelationship',
                                     'argument 5 (argument 6 as invoked from Typescript)',
                                     'CharacterMandate.compact line 319 char 1',
                                     'Uint<0..18446744073709551616>',
                                     budget_0)
        }
        if (!(typeof(expiry_0) === 'bigint' && expiry_0 >= 0n && expiry_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('openRelationship',
                                     'argument 6 (argument 7 as invoked from Typescript)',
                                     'CharacterMandate.compact line 319 char 1',
                                     'Uint<0..18446744073709551616>',
                                     expiry_0)
        }
        if (!(nonce_0.buffer instanceof ArrayBuffer && nonce_0.BYTES_PER_ELEMENT === 1 && nonce_0.length === 32)) {
          __compactRuntime.typeError('openRelationship',
                                     'argument 7 (argument 8 as invoked from Typescript)',
                                     'CharacterMandate.compact line 319 char 1',
                                     'Bytes<32>',
                                     nonce_0)
        }
        if (!(relationshipNonce_0.buffer instanceof ArrayBuffer && relationshipNonce_0.BYTES_PER_ELEMENT === 1 && relationshipNonce_0.length === 32)) {
          __compactRuntime.typeError('openRelationship',
                                     'argument 8 (argument 9 as invoked from Typescript)',
                                     'CharacterMandate.compact line 319 char 1',
                                     'Bytes<32>',
                                     relationshipNonce_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_7.toValue(characterId_0).concat(_descriptor_3.toValue(targetWeightBps_0).concat(_descriptor_3.toValue(allowedDriftBps_0).concat(_descriptor_5.toValue(autoThreshold_0).concat(_descriptor_5.toValue(budget_0).concat(_descriptor_5.toValue(expiry_0).concat(_descriptor_1.toValue(nonce_0).concat(_descriptor_1.toValue(relationshipNonce_0)))))))),
            alignment: _descriptor_7.alignment().concat(_descriptor_3.alignment().concat(_descriptor_3.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment())))))))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._openRelationship_0(context,
                                                  partialProofData,
                                                  characterId_0,
                                                  targetWeightBps_0,
                                                  allowedDriftBps_0,
                                                  autoThreshold_0,
                                                  budget_0,
                                                  expiry_0,
                                                  nonce_0,
                                                  relationshipNonce_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      proveDecision: (...args_1) => {
        if (args_1.length !== 27) {
          throw new __compactRuntime.CompactError(`proveDecision: expected 27 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const decisionId_0 = args_1[1];
        const characterId_0 = args_1[2];
        const targetWeightBps_0 = args_1[3];
        const allowedDriftBps_0 = args_1[4];
        const autoThreshold_0 = args_1[5];
        const budget_0 = args_1[6];
        const expiry_0 = args_1[7];
        const mandateNonce_0 = args_1[8];
        const spent_0 = args_1[9];
        const trustScore_0 = args_1[10];
        const historyDigest_0 = args_1[11];
        const relationshipNonce_0 = args_1[12];
        const currentTimestamp_0 = args_1[13];
        const valueA_0 = args_1[14];
        const valueB_0 = args_1[15];
        const currentWeightA_0 = args_1[16];
        const currentWeightARemainder_0 = args_1[17];
        const currentWeightB_0 = args_1[18];
        const currentWeightBRemainder_0 = args_1[19];
        const targetValueA_0 = args_1[20];
        const targetValueARemainder_0 = args_1[21];
        const targetValueB_0 = args_1[22];
        const targetValueBRemainder_0 = args_1[23];
        const effectiveCap_0 = args_1[24];
        const effectiveCapRemainder_0 = args_1[25];
        const totalCost_0 = args_1[26];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 1 (as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(decisionId_0.buffer instanceof ArrayBuffer && decisionId_0.BYTES_PER_ELEMENT === 1 && decisionId_0.length === 32)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Bytes<32>',
                                     decisionId_0)
        }
        if (!(typeof(characterId_0) === 'bigint' && characterId_0 >= 0n && characterId_0 <= 255n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..256>',
                                     characterId_0)
        }
        if (!(typeof(targetWeightBps_0) === 'bigint' && targetWeightBps_0 >= 0n && targetWeightBps_0 <= 65535n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..65536>',
                                     targetWeightBps_0)
        }
        if (!(typeof(allowedDriftBps_0) === 'bigint' && allowedDriftBps_0 >= 0n && allowedDriftBps_0 <= 65535n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..65536>',
                                     allowedDriftBps_0)
        }
        if (!(typeof(autoThreshold_0) === 'bigint' && autoThreshold_0 >= 0n && autoThreshold_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 5 (argument 6 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     autoThreshold_0)
        }
        if (!(typeof(budget_0) === 'bigint' && budget_0 >= 0n && budget_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 6 (argument 7 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     budget_0)
        }
        if (!(typeof(expiry_0) === 'bigint' && expiry_0 >= 0n && expiry_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 7 (argument 8 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     expiry_0)
        }
        if (!(mandateNonce_0.buffer instanceof ArrayBuffer && mandateNonce_0.BYTES_PER_ELEMENT === 1 && mandateNonce_0.length === 32)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 8 (argument 9 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Bytes<32>',
                                     mandateNonce_0)
        }
        if (!(typeof(spent_0) === 'bigint' && spent_0 >= 0n && spent_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 9 (argument 10 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     spent_0)
        }
        if (!(typeof(trustScore_0) === 'bigint' && trustScore_0 >= 0n && trustScore_0 <= 255n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 10 (argument 11 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..256>',
                                     trustScore_0)
        }
        if (!(historyDigest_0.buffer instanceof ArrayBuffer && historyDigest_0.BYTES_PER_ELEMENT === 1 && historyDigest_0.length === 32)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 11 (argument 12 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Bytes<32>',
                                     historyDigest_0)
        }
        if (!(relationshipNonce_0.buffer instanceof ArrayBuffer && relationshipNonce_0.BYTES_PER_ELEMENT === 1 && relationshipNonce_0.length === 32)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 12 (argument 13 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Bytes<32>',
                                     relationshipNonce_0)
        }
        if (!(typeof(currentTimestamp_0) === 'bigint' && currentTimestamp_0 >= 0n && currentTimestamp_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 13 (argument 14 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     currentTimestamp_0)
        }
        if (!(typeof(valueA_0) === 'bigint' && valueA_0 >= 0n && valueA_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 14 (argument 15 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     valueA_0)
        }
        if (!(typeof(valueB_0) === 'bigint' && valueB_0 >= 0n && valueB_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 15 (argument 16 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     valueB_0)
        }
        if (!(typeof(currentWeightA_0) === 'bigint' && currentWeightA_0 >= 0n && currentWeightA_0 <= 65535n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 16 (argument 17 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..65536>',
                                     currentWeightA_0)
        }
        if (!(typeof(currentWeightARemainder_0) === 'bigint' && currentWeightARemainder_0 >= 0n && currentWeightARemainder_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 17 (argument 18 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     currentWeightARemainder_0)
        }
        if (!(typeof(currentWeightB_0) === 'bigint' && currentWeightB_0 >= 0n && currentWeightB_0 <= 65535n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 18 (argument 19 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..65536>',
                                     currentWeightB_0)
        }
        if (!(typeof(currentWeightBRemainder_0) === 'bigint' && currentWeightBRemainder_0 >= 0n && currentWeightBRemainder_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 19 (argument 20 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     currentWeightBRemainder_0)
        }
        if (!(typeof(targetValueA_0) === 'bigint' && targetValueA_0 >= 0n && targetValueA_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 20 (argument 21 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     targetValueA_0)
        }
        if (!(typeof(targetValueARemainder_0) === 'bigint' && targetValueARemainder_0 >= 0n && targetValueARemainder_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 21 (argument 22 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     targetValueARemainder_0)
        }
        if (!(typeof(targetValueB_0) === 'bigint' && targetValueB_0 >= 0n && targetValueB_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 22 (argument 23 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     targetValueB_0)
        }
        if (!(typeof(targetValueBRemainder_0) === 'bigint' && targetValueBRemainder_0 >= 0n && targetValueBRemainder_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 23 (argument 24 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     targetValueBRemainder_0)
        }
        if (!(typeof(effectiveCap_0) === 'bigint' && effectiveCap_0 >= 0n && effectiveCap_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 24 (argument 25 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     effectiveCap_0)
        }
        if (!(typeof(effectiveCapRemainder_0) === 'bigint' && effectiveCapRemainder_0 >= 0n && effectiveCapRemainder_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 25 (argument 26 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     effectiveCapRemainder_0)
        }
        if (!(typeof(totalCost_0) === 'bigint' && totalCost_0 >= 0n && totalCost_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('proveDecision',
                                     'argument 26 (argument 27 as invoked from Typescript)',
                                     'CharacterMandate.compact line 380 char 1',
                                     'Uint<0..18446744073709551616>',
                                     totalCost_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(decisionId_0).concat(_descriptor_7.toValue(characterId_0).concat(_descriptor_3.toValue(targetWeightBps_0).concat(_descriptor_3.toValue(allowedDriftBps_0).concat(_descriptor_5.toValue(autoThreshold_0).concat(_descriptor_5.toValue(budget_0).concat(_descriptor_5.toValue(expiry_0).concat(_descriptor_1.toValue(mandateNonce_0).concat(_descriptor_5.toValue(spent_0).concat(_descriptor_7.toValue(trustScore_0).concat(_descriptor_1.toValue(historyDigest_0).concat(_descriptor_1.toValue(relationshipNonce_0).concat(_descriptor_5.toValue(currentTimestamp_0).concat(_descriptor_5.toValue(valueA_0).concat(_descriptor_5.toValue(valueB_0).concat(_descriptor_3.toValue(currentWeightA_0).concat(_descriptor_5.toValue(currentWeightARemainder_0).concat(_descriptor_3.toValue(currentWeightB_0).concat(_descriptor_5.toValue(currentWeightBRemainder_0).concat(_descriptor_5.toValue(targetValueA_0).concat(_descriptor_5.toValue(targetValueARemainder_0).concat(_descriptor_5.toValue(targetValueB_0).concat(_descriptor_5.toValue(targetValueBRemainder_0).concat(_descriptor_5.toValue(effectiveCap_0).concat(_descriptor_5.toValue(effectiveCapRemainder_0).concat(_descriptor_5.toValue(totalCost_0)))))))))))))))))))))))))),
            alignment: _descriptor_1.alignment().concat(_descriptor_7.alignment().concat(_descriptor_3.alignment().concat(_descriptor_3.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_1.alignment().concat(_descriptor_5.alignment().concat(_descriptor_7.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_3.alignment().concat(_descriptor_5.alignment().concat(_descriptor_3.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment())))))))))))))))))))))))))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._proveDecision_0(context,
                                               partialProofData,
                                               decisionId_0,
                                               characterId_0,
                                               targetWeightBps_0,
                                               allowedDriftBps_0,
                                               autoThreshold_0,
                                               budget_0,
                                               expiry_0,
                                               mandateNonce_0,
                                               spent_0,
                                               trustScore_0,
                                               historyDigest_0,
                                               relationshipNonce_0,
                                               currentTimestamp_0,
                                               valueA_0,
                                               valueB_0,
                                               currentWeightA_0,
                                               currentWeightARemainder_0,
                                               currentWeightB_0,
                                               currentWeightBRemainder_0,
                                               targetValueA_0,
                                               targetValueARemainder_0,
                                               targetValueB_0,
                                               targetValueBRemainder_0,
                                               effectiveCap_0,
                                               effectiveCapRemainder_0,
                                               totalCost_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      resolvePending: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`resolvePending: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const decisionId_0 = args_1[1];
        const approved_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('resolvePending',
                                     'argument 1 (as invoked from Typescript)',
                                     'CharacterMandate.compact line 552 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(decisionId_0.buffer instanceof ArrayBuffer && decisionId_0.BYTES_PER_ELEMENT === 1 && decisionId_0.length === 32)) {
          __compactRuntime.typeError('resolvePending',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'CharacterMandate.compact line 552 char 1',
                                     'Bytes<32>',
                                     decisionId_0)
        }
        if (!(typeof(approved_0) === 'boolean')) {
          __compactRuntime.typeError('resolvePending',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'CharacterMandate.compact line 552 char 1',
                                     'Boolean',
                                     approved_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(decisionId_0).concat(_descriptor_0.toValue(approved_0)),
            alignment: _descriptor_1.alignment().concat(_descriptor_0.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._resolvePending_0(context,
                                                partialProofData,
                                                decisionId_0,
                                                approved_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      recordRelationshipEvent: (...args_1) => {
        if (args_1.length !== 11) {
          throw new __compactRuntime.CompactError(`recordRelationshipEvent: expected 11 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const decisionId_0 = args_1[1];
        const eventKind_0 = args_1[2];
        const oldSpent_0 = args_1[3];
        const oldTrustScore_0 = args_1[4];
        const oldHistoryDigest_0 = args_1[5];
        const relationshipNonce_0 = args_1[6];
        const valueQuote_0 = args_1[7];
        const frictionQuote_0 = args_1[8];
        const operatingCost_0 = args_1[9];
        const sourceDigest_0 = args_1[10];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('recordRelationshipEvent',
                                     'argument 1 (as invoked from Typescript)',
                                     'CharacterMandate.compact line 586 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(decisionId_0.buffer instanceof ArrayBuffer && decisionId_0.BYTES_PER_ELEMENT === 1 && decisionId_0.length === 32)) {
          __compactRuntime.typeError('recordRelationshipEvent',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'CharacterMandate.compact line 586 char 1',
                                     'Bytes<32>',
                                     decisionId_0)
        }
        if (!(typeof(eventKind_0) === 'bigint' && eventKind_0 >= 0n && eventKind_0 <= 255n)) {
          __compactRuntime.typeError('recordRelationshipEvent',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'CharacterMandate.compact line 586 char 1',
                                     'Uint<0..256>',
                                     eventKind_0)
        }
        if (!(typeof(oldSpent_0) === 'bigint' && oldSpent_0 >= 0n && oldSpent_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('recordRelationshipEvent',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'CharacterMandate.compact line 586 char 1',
                                     'Uint<0..18446744073709551616>',
                                     oldSpent_0)
        }
        if (!(typeof(oldTrustScore_0) === 'bigint' && oldTrustScore_0 >= 0n && oldTrustScore_0 <= 255n)) {
          __compactRuntime.typeError('recordRelationshipEvent',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'CharacterMandate.compact line 586 char 1',
                                     'Uint<0..256>',
                                     oldTrustScore_0)
        }
        if (!(oldHistoryDigest_0.buffer instanceof ArrayBuffer && oldHistoryDigest_0.BYTES_PER_ELEMENT === 1 && oldHistoryDigest_0.length === 32)) {
          __compactRuntime.typeError('recordRelationshipEvent',
                                     'argument 5 (argument 6 as invoked from Typescript)',
                                     'CharacterMandate.compact line 586 char 1',
                                     'Bytes<32>',
                                     oldHistoryDigest_0)
        }
        if (!(relationshipNonce_0.buffer instanceof ArrayBuffer && relationshipNonce_0.BYTES_PER_ELEMENT === 1 && relationshipNonce_0.length === 32)) {
          __compactRuntime.typeError('recordRelationshipEvent',
                                     'argument 6 (argument 7 as invoked from Typescript)',
                                     'CharacterMandate.compact line 586 char 1',
                                     'Bytes<32>',
                                     relationshipNonce_0)
        }
        if (!(typeof(valueQuote_0) === 'bigint' && valueQuote_0 >= 0n && valueQuote_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('recordRelationshipEvent',
                                     'argument 7 (argument 8 as invoked from Typescript)',
                                     'CharacterMandate.compact line 586 char 1',
                                     'Uint<0..18446744073709551616>',
                                     valueQuote_0)
        }
        if (!(typeof(frictionQuote_0) === 'bigint' && frictionQuote_0 >= 0n && frictionQuote_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('recordRelationshipEvent',
                                     'argument 8 (argument 9 as invoked from Typescript)',
                                     'CharacterMandate.compact line 586 char 1',
                                     'Uint<0..18446744073709551616>',
                                     frictionQuote_0)
        }
        if (!(typeof(operatingCost_0) === 'bigint' && operatingCost_0 >= 0n && operatingCost_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('recordRelationshipEvent',
                                     'argument 9 (argument 10 as invoked from Typescript)',
                                     'CharacterMandate.compact line 586 char 1',
                                     'Uint<0..18446744073709551616>',
                                     operatingCost_0)
        }
        if (!(sourceDigest_0.buffer instanceof ArrayBuffer && sourceDigest_0.BYTES_PER_ELEMENT === 1 && sourceDigest_0.length === 32)) {
          __compactRuntime.typeError('recordRelationshipEvent',
                                     'argument 10 (argument 11 as invoked from Typescript)',
                                     'CharacterMandate.compact line 586 char 1',
                                     'Bytes<32>',
                                     sourceDigest_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_1.toValue(decisionId_0).concat(_descriptor_7.toValue(eventKind_0).concat(_descriptor_5.toValue(oldSpent_0).concat(_descriptor_7.toValue(oldTrustScore_0).concat(_descriptor_1.toValue(oldHistoryDigest_0).concat(_descriptor_1.toValue(relationshipNonce_0).concat(_descriptor_5.toValue(valueQuote_0).concat(_descriptor_5.toValue(frictionQuote_0).concat(_descriptor_5.toValue(operatingCost_0).concat(_descriptor_1.toValue(sourceDigest_0)))))))))),
            alignment: _descriptor_1.alignment().concat(_descriptor_7.alignment().concat(_descriptor_5.alignment().concat(_descriptor_7.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_1.alignment())))))))))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._recordRelationshipEvent_0(context,
                                                         partialProofData,
                                                         decisionId_0,
                                                         eventKind_0,
                                                         oldSpent_0,
                                                         oldTrustScore_0,
                                                         oldHistoryDigest_0,
                                                         relationshipNonce_0,
                                                         valueQuote_0,
                                                         frictionQuote_0,
                                                         operatingCost_0,
                                                         sourceDigest_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      revokeRelationship: (...args_1) => {
        if (args_1.length !== 1) {
          throw new __compactRuntime.CompactError(`revokeRelationship: expected 1 argument (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('revokeRelationship',
                                     'argument 1 (as invoked from Typescript)',
                                     'CharacterMandate.compact line 676 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: { value: [], alignment: [] },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._revokeRelationship_0(context, partialProofData);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      openRelationship: this.circuits.openRelationship,
      proveDecision: this.circuits.proveDecision,
      resolvePending: this.circuits.resolvePending,
      recordRelationshipEvent: this.circuits.recordRelationshipEvent,
      revokeRelationship: this.circuits.revokeRelationship
    };
    this.provableCircuits = {
      openRelationship: this.circuits.openRelationship,
      proveDecision: this.circuits.proveDecision,
      resolvePending: this.circuits.resolvePending,
      recordRelationshipEvent: this.circuits.recordRelationshipEvent,
      revokeRelationship: this.circuits.revokeRelationship
    };
  }
  initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('openRelationship', new __compactRuntime.ContractOperation());
    state_0.setOperation('proveDecision', new __compactRuntime.ContractOperation());
    state_0.setOperation('resolvePending', new __compactRuntime.ContractOperation());
    state_0.setOperation('recordRelationshipEvent', new __compactRuntime.ContractOperation());
    state_0.setOperation('revokeRelationship', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(0n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(1n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(2n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(3n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(0n),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(4n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(false),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(5n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(6n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue({ is_some: false, value: new Uint8Array(32) }),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(7n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(0n),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(8n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue({ decisionId: new Uint8Array(32), status: 0, catalogVersion: 0n, trustFormulaVersion: 0n, circuitVersion: 0n, sequence: 0n }),
                                                                                              alignment: _descriptor_6.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(0n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(1n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(2n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(4n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(false),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_0 = this._none_0();
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(6n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tmp_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_1 = { decisionId:
                      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                    status: 0,
                    catalogVersion: 1n,
                    trustFormulaVersion: 1n,
                    circuitVersion: 1n,
                    sequence: 0n };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(8n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(tmp_1),
                                                                                              alignment: _descriptor_6.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _some_0(value_0) { return { is_some: true, value: value_0 }; }
  _none_0() { return { is_some: false, value: new Uint8Array(32) }; }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_12, value_0);
    return result_0;
  }
  _persistentHash_1(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_13, value_0);
    return result_0;
  }
  _persistentHash_2(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_10, value_0);
    return result_0;
  }
  _persistentHash_3(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_11, value_0);
    return result_0;
  }
  _persistentHash_4(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_9, value_0);
    return result_0;
  }
  _localOwnerSecret_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.localOwnerSecret(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('localOwnerSecret',
                                 'return value',
                                 'CharacterMandate.compact line 36 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _computeOwnerCommitment_0(ownerSecret_0, version_0) {
    return this._persistentHash_3([new Uint8Array([100, 114, 105, 102, 116, 109, 97, 116, 101, 58, 111, 119, 110, 101, 114, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   ownerSecret_0,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        version_0,
                                                                        'CharacterMandate.compact line 45 char 5')]);
  }
  _computeMandateCommitment_0(characterId_0,
                              targetWeightBps_0,
                              allowedDriftBps_0,
                              autoThreshold_0,
                              budget_0,
                              expiry_0,
                              nonce_0,
                              version_0)
  {
    return this._persistentHash_0([new Uint8Array([100, 114, 105, 102, 116, 109, 97, 116, 101, 58, 109, 97, 110, 100, 97, 116, 101, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        characterId_0,
                                                                        'CharacterMandate.compact line 61 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        targetWeightBps_0,
                                                                        'CharacterMandate.compact line 62 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        allowedDriftBps_0,
                                                                        'CharacterMandate.compact line 63 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        autoThreshold_0,
                                                                        'CharacterMandate.compact line 64 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        budget_0,
                                                                        'CharacterMandate.compact line 65 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        expiry_0,
                                                                        'CharacterMandate.compact line 66 char 5'),
                                   nonce_0,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        version_0,
                                                                        'CharacterMandate.compact line 68 char 5')]);
  }
  _computeRelationshipCommitment_0(ownerHash_0,
                                   mandateHash_0,
                                   spent_0,
                                   trustScore_0,
                                   historyDigest_0,
                                   relationshipNonce_0,
                                   version_0)
  {
    return this._persistentHash_1([new Uint8Array([100, 114, 105, 102, 116, 109, 97, 116, 101, 58, 114, 101, 108, 97, 116, 105, 111, 110, 115, 104, 105, 112, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0]),
                                   ownerHash_0,
                                   mandateHash_0,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        spent_0,
                                                                        'CharacterMandate.compact line 85 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        trustScore_0,
                                                                        'CharacterMandate.compact line 86 char 5'),
                                   historyDigest_0,
                                   relationshipNonce_0,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        version_0,
                                                                        'CharacterMandate.compact line 89 char 5')]);
  }
  _decisionKey_0(decisionId_0, version_0) {
    return this._persistentHash_3([new Uint8Array([100, 114, 105, 102, 116, 109, 97, 116, 101, 58, 100, 101, 99, 105, 115, 105, 111, 110, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   decisionId_0,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        version_0,
                                                                        'CharacterMandate.compact line 97 char 5')]);
  }
  _eventKey_0(decisionId_0, eventKind_0, version_0) {
    return this._persistentHash_4([new Uint8Array([100, 114, 105, 102, 116, 109, 97, 116, 101, 58, 101, 118, 101, 110, 116, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   decisionId_0,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        eventKind_0,
                                                                        'CharacterMandate.compact line 105 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        version_0,
                                                                        'CharacterMandate.compact line 106 char 5')]);
  }
  _computeHistoryAfter_0(previous_0,
                         decisionId_0,
                         eventKind_0,
                         sourceDigest_0,
                         newTrustScore_0,
                         newSpent_0)
  {
    return this._persistentHash_2([new Uint8Array([100, 114, 105, 102, 116, 109, 97, 116, 101, 58, 104, 105, 115, 116, 111, 114, 121, 58, 118, 49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                   previous_0,
                                   decisionId_0,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        eventKind_0,
                                                                        'CharacterMandate.compact line 122 char 5'),
                                   sourceDigest_0,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        newTrustScore_0,
                                                                        'CharacterMandate.compact line 124 char 5'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        newSpent_0,
                                                                        'CharacterMandate.compact line 125 char 5')]);
  }
  _assertMandate_0(characterId_0,
                   targetWeightBps_0,
                   allowedDriftBps_0,
                   autoThreshold_0,
                   budget_0,
                   expiry_0,
                   nonce_0,
                   relationshipNonce_0)
  {
    const MAX_VALUE_0 = 800000000000000n;
    __compactRuntime.assert(this._equal_0(characterId_0, 1n)
                            ||
                            this._equal_1(characterId_0, 2n),
                            'unknown character');
    __compactRuntime.assert(this._equal_2(characterId_0, 1n)
                            &&
                            this._equal_3(allowedDriftBps_0, 300n)
                            ||
                            this._equal_4(characterId_0, 2n)
                            &&
                            this._equal_5(allowedDriftBps_0, 1000n),
                            'character strategy mismatch');
    __compactRuntime.assert(targetWeightBps_0 > allowedDriftBps_0,
                            'target below strategy band');
    let t_0;
    __compactRuntime.assert((t_0 = targetWeightBps_0 + allowedDriftBps_0,
                             t_0 < 10000n),
                            'target above strategy band');
    __compactRuntime.assert(autoThreshold_0 > 0n && autoThreshold_0 <= budget_0,
                            'invalid threshold');
    __compactRuntime.assert(budget_0 <= MAX_VALUE_0, 'budget out of range');
    __compactRuntime.assert(expiry_0 > 0n, 'invalid expiry');
    __compactRuntime.assert(!this._equal_6(nonce_0,
                                           new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'invalid mandate nonce');
    __compactRuntime.assert(!this._equal_7(relationshipNonce_0,
                                           new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'invalid relationship nonce');
    __compactRuntime.assert(!this._equal_8(nonce_0, relationshipNonce_0),
                            'nonces must differ');
    return [];
  }
  _assertRelationship_0(context,
                        partialProofData,
                        ownerSecret_0,
                        spent_0,
                        trustScore_0,
                        historyDigest_0,
                        relationshipNonce_0,
                        version_0)
  {
    __compactRuntime.assert(trustScore_0 <= 100n, 'invalid trust score');
    const ownerHash_0 = this._computeOwnerCommitment_0(ownerSecret_0, version_0);
    __compactRuntime.assert(this._equal_9(ownerHash_0,
                                          _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_7.toValue(0n),
                                                                                                                                alignment: _descriptor_7.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value)),
                            'owner authentication failed');
    __compactRuntime.assert(this._equal_10(this._computeRelationshipCommitment_0(ownerHash_0,
                                                                                 _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                                                           partialProofData,
                                                                                                                                           [
                                                                                                                                            { dup: { n: 0 } },
                                                                                                                                            { idx: { cached: false,
                                                                                                                                                     pushPath: false,
                                                                                                                                                     path: [
                                                                                                                                                            { tag: 'value',
                                                                                                                                                              value: { value: _descriptor_7.toValue(1n),
                                                                                                                                                                       alignment: _descriptor_7.alignment() } }] } },
                                                                                                                                            { popeq: { cached: false,
                                                                                                                                                       result: undefined } }]).value),
                                                                                 spent_0,
                                                                                 trustScore_0,
                                                                                 historyDigest_0,
                                                                                 relationshipNonce_0,
                                                                                 version_0),
                                           _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                     partialProofData,
                                                                                                     [
                                                                                                      { dup: { n: 0 } },
                                                                                                      { idx: { cached: false,
                                                                                                               pushPath: false,
                                                                                                               path: [
                                                                                                                      { tag: 'value',
                                                                                                                        value: { value: _descriptor_7.toValue(2n),
                                                                                                                                 alignment: _descriptor_7.alignment() } }] } },
                                                                                                      { popeq: { cached: false,
                                                                                                                 result: undefined } }]).value)),
                            'relationship state mismatch');
    return [];
  }
  _quotientIsValid_0(dividend_0, divisor_0, quotient_0, remainder_0) {
    return this._equal_11(quotient_0 * divisor_0 + remainder_0, dividend_0)
           &&
           remainder_0 < divisor_0;
  }
  _multiply64x16_0(left_0, right_0) { return left_0 * right_0; }
  _absDiff16_0(left_0, right_0) {
    if (left_0 >= right_0) {
      __compactRuntime.assert(left_0 >= right_0,
                              'result of subtraction would be negative');
      return left_0 - right_0;
    } else {
      __compactRuntime.assert(right_0 >= left_0,
                              'result of subtraction would be negative');
      return right_0 - left_0;
    }
  }
  _absDiff64_0(left_0, right_0) {
    if (left_0 >= right_0) {
      __compactRuntime.assert(left_0 >= right_0,
                              'result of subtraction would be negative');
      return left_0 - right_0;
    } else {
      __compactRuntime.assert(right_0 >= left_0,
                              'result of subtraction would be negative');
      return right_0 - left_0;
    }
  }
  _max16_0(left_0, right_0) {
    if (left_0 >= right_0) { return left_0; } else { return right_0; }
  }
  _min64_0(left_0, right_0) {
    if (left_0 <= right_0) { return left_0; } else { return right_0; }
  }
  _goalWeight_0(characterId_0,
                currentWeightBps_0,
                targetWeightBps_0,
                allowedDriftBps_0)
  {
    if (this._equal_12(characterId_0, 1n)) {
      return targetWeightBps_0;
    } else {
      if (currentWeightBps_0 > targetWeightBps_0) {
        return ((t1) => {
                 if (t1 > 65535n) {
                   throw new __compactRuntime.CompactError('CharacterMandate.compact line 235 char 12: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 65535');
                 }
                 return t1;
               })(targetWeightBps_0 + allowedDriftBps_0);
      } else {
        __compactRuntime.assert(targetWeightBps_0 >= allowedDriftBps_0,
                                'result of subtraction would be negative');
        return targetWeightBps_0 - allowedDriftBps_0;
      }
    }
  }
  _minTradeValue_0(characterId_0) {
    return this._equal_13(characterId_0, 1n) ? 1000000n : 5000000n;
  }
  _addTrust_0(score_0, amount_0) {
    const sum_0 = score_0 + amount_0;
    if (sum_0 > 100n) {
      return 100n;
    } else {
      return ((t1) => {
               if (t1 > 255n) {
                 throw new __compactRuntime.CompactError('CharacterMandate.compact line 254 char 12: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 255');
               }
               return t1;
             })(sum_0);
    }
  }
  _subtractTrust_0(score_0, amount_0) {
    if (score_0 < amount_0) {
      return 0n;
    } else {
      __compactRuntime.assert(score_0 >= amount_0,
                              'result of subtraction would be negative');
      return score_0 - amount_0;
    }
  }
  _computeTrustAfterEvent_0(oldTrustScore_0,
                            eventKind_0,
                            valueQuote_0,
                            frictionQuote_0,
                            operatingCost_0)
  {
    if (this._equal_14(eventKind_0, 1n)) {
      __compactRuntime.assert(valueQuote_0 > 0n, 'execution value required');
      const friction_0 = frictionQuote_0 + operatingCost_0;
      const frictionBpsDividend_0 = friction_0 * 10000n;
      const efficientBoundary_0 = valueQuote_0 * 50n;
      const wastefulBoundary_0 = valueQuote_0 * 150n;
      if (frictionBpsDividend_0 <= efficientBoundary_0) {
        return this._addTrust_0(oldTrustScore_0, 3n);
      } else {
        if (frictionBpsDividend_0 > wastefulBoundary_0) {
          return this._subtractTrust_0(oldTrustScore_0, 5n);
        } else {
          return oldTrustScore_0;
        }
      }
    } else {
      if (this._equal_15(eventKind_0, 2n)) {
        return this._subtractTrust_0(oldTrustScore_0, 2n);
      } else {
        if (this._equal_16(eventKind_0, 3n)) {
          return this._subtractTrust_0(oldTrustScore_0, 3n);
        } else {
          return this._subtractTrust_0(oldTrustScore_0, 15n);
        }
      }
    }
  }
  _spentAfterEvent_0(oldSpent_0, eventKind_0, valueQuote_0) {
    if (this._equal_17(eventKind_0, 1n)) {
      return ((t1) => {
               if (t1 > 18446744073709551615n) {
                 throw new __compactRuntime.CompactError('CharacterMandate.compact line 297 char 12: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
               }
               return t1;
             })(oldSpent_0 + valueQuote_0);
    } else {
      return oldSpent_0;
    }
  }
  _openRelationship_0(context,
                      partialProofData,
                      characterId_0,
                      targetWeightBps_0,
                      allowedDriftBps_0,
                      autoThreshold_0,
                      budget_0,
                      expiry_0,
                      nonce_0,
                      relationshipNonce_0)
  {
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_7.toValue(4n),
                                                                                                                   alignment: _descriptor_7.alignment() } }] } },
                                                                                        { popeq: { cached: false,
                                                                                                   result: undefined } }]).value),
                            'relationship already active');
    this._assertMandate_0(characterId_0,
                          targetWeightBps_0,
                          allowedDriftBps_0,
                          autoThreshold_0,
                          budget_0,
                          expiry_0,
                          nonce_0,
                          relationshipNonce_0);
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_7.toValue(3n),
                                                                  alignment: _descriptor_7.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_3.toValue(tmp_0),
                                                                alignment: _descriptor_3.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    const version_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                partialProofData,
                                                                                [
                                                                                 { dup: { n: 0 } },
                                                                                 { idx: { cached: false,
                                                                                          pushPath: false,
                                                                                          path: [
                                                                                                 { tag: 'value',
                                                                                                   value: { value: _descriptor_7.toValue(3n),
                                                                                                            alignment: _descriptor_7.alignment() } }] } },
                                                                                 { popeq: { cached: true,
                                                                                            result: undefined } }]).value);
    const ownerHash_0 = this._computeOwnerCommitment_0(this._localOwnerSecret_0(context,
                                                                                partialProofData),
                                                       version_0);
    const mandateHash_0 = this._computeMandateCommitment_0(characterId_0,
                                                           targetWeightBps_0,
                                                           allowedDriftBps_0,
                                                           autoThreshold_0,
                                                           budget_0,
                                                           expiry_0,
                                                           nonce_0,
                                                           version_0);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(0n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(ownerHash_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(1n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(mandateHash_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_1 = this._computeRelationshipCommitment_0(ownerHash_0,
                                                        mandateHash_0,
                                                        0n,
                                                        50n,
                                                        new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                                        relationshipNonce_0,
                                                        version_0);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(2n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tmp_1),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(4n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(true),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_2 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_7.toValue(7n),
                                                                  alignment: _descriptor_7.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_3.toValue(tmp_2),
                                                                alignment: _descriptor_3.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_3 = { decisionId:
                      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                    status: 1,
                    catalogVersion: 1n,
                    trustFormulaVersion: 1n,
                    circuitVersion: 1n,
                    sequence:
                      _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                partialProofData,
                                                                                [
                                                                                 { dup: { n: 0 } },
                                                                                 { idx: { cached: false,
                                                                                          pushPath: false,
                                                                                          path: [
                                                                                                 { tag: 'value',
                                                                                                   value: { value: _descriptor_7.toValue(7n),
                                                                                                            alignment: _descriptor_7.alignment() } }] } },
                                                                                 { popeq: { cached: true,
                                                                                            result: undefined } }]).value) };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(8n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(tmp_3),
                                                                                              alignment: _descriptor_6.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _proveDecision_0(context,
                   partialProofData,
                   decisionId_0,
                   characterId_0,
                   targetWeightBps_0,
                   allowedDriftBps_0,
                   autoThreshold_0,
                   budget_0,
                   expiry_0,
                   mandateNonce_0,
                   spent_0,
                   trustScore_0,
                   historyDigest_0,
                   relationshipNonce_0,
                   currentTimestamp_0,
                   valueA_0,
                   valueB_0,
                   currentWeightA_0,
                   currentWeightARemainder_0,
                   currentWeightB_0,
                   currentWeightBRemainder_0,
                   targetValueA_0,
                   targetValueARemainder_0,
                   targetValueB_0,
                   targetValueBRemainder_0,
                   effectiveCap_0,
                   effectiveCapRemainder_0,
                   totalCost_0)
  {
    const MAX_VALUE_0 = 800000000000000n;
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_7.toValue(4n),
                                                                                                                  alignment: _descriptor_7.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value),
                            'relationship inactive');
    __compactRuntime.assert(!this._equal_18(decisionId_0,
                                            new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
                            'invalid decision id');
    this._assertMandate_0(characterId_0,
                          targetWeightBps_0,
                          allowedDriftBps_0,
                          autoThreshold_0,
                          budget_0,
                          expiry_0,
                          mandateNonce_0,
                          relationshipNonce_0);
    const version_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                partialProofData,
                                                                                [
                                                                                 { dup: { n: 0 } },
                                                                                 { idx: { cached: false,
                                                                                          pushPath: false,
                                                                                          path: [
                                                                                                 { tag: 'value',
                                                                                                   value: { value: _descriptor_7.toValue(3n),
                                                                                                            alignment: _descriptor_7.alignment() } }] } },
                                                                                 { popeq: { cached: true,
                                                                                            result: undefined } }]).value);
    __compactRuntime.assert(this._equal_19(this._computeMandateCommitment_0(characterId_0,
                                                                            targetWeightBps_0,
                                                                            allowedDriftBps_0,
                                                                            autoThreshold_0,
                                                                            budget_0,
                                                                            expiry_0,
                                                                            mandateNonce_0,
                                                                            version_0),
                                           _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                     partialProofData,
                                                                                                     [
                                                                                                      { dup: { n: 0 } },
                                                                                                      { idx: { cached: false,
                                                                                                               pushPath: false,
                                                                                                               path: [
                                                                                                                      { tag: 'value',
                                                                                                                        value: { value: _descriptor_7.toValue(1n),
                                                                                                                                 alignment: _descriptor_7.alignment() } }] } },
                                                                                                      { popeq: { cached: false,
                                                                                                                 result: undefined } }]).value)),
                            'mandate commitment mismatch');
    this._assertRelationship_0(context,
                               partialProofData,
                               this._localOwnerSecret_0(context,
                                                        partialProofData),
                               spent_0,
                               trustScore_0,
                               historyDigest_0,
                               relationshipNonce_0,
                               version_0);
    __compactRuntime.assert(currentTimestamp_0 <= expiry_0, 'mandate expired');
    __compactRuntime.assert(valueA_0 <= MAX_VALUE_0 && valueB_0 <= MAX_VALUE_0,
                            'asset value out of range');
    __compactRuntime.assert(totalCost_0 <= MAX_VALUE_0, 'cost out of range');
    const key_0 = this._decisionKey_0(decisionId_0, version_0);
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_7.toValue(5n),
                                                                                                                   alignment: _descriptor_7.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                                                                               alignment: _descriptor_1.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'decision already used');
    const totalValue_0 = ((t1) => {
                           if (t1 > 18446744073709551615n) {
                             throw new __compactRuntime.CompactError('CharacterMandate.compact line 449 char 22: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                           }
                           return t1;
                         })(valueA_0 + valueB_0);
    __compactRuntime.assert(totalValue_0 > 0n, 'empty portfolio');
    __compactRuntime.assert(this._quotientIsValid_0(this._multiply64x16_0(valueA_0,
                                                                          10000n),
                                                    totalValue_0,
                                                    currentWeightA_0,
                                                    currentWeightARemainder_0),
                            'invalid asset A weight');
    __compactRuntime.assert(this._quotientIsValid_0(this._multiply64x16_0(valueB_0,
                                                                          10000n),
                                                    totalValue_0,
                                                    currentWeightB_0,
                                                    currentWeightBRemainder_0),
                            'invalid asset B weight');
    const targetWeightBpsB_0 = (__compactRuntime.assert(10000n
                                                        >=
                                                        targetWeightBps_0,
                                                        'result of subtraction would be negative'),
                                10000n - targetWeightBps_0);
    const drift_0 = this._max16_0(this._absDiff16_0(currentWeightA_0,
                                                    targetWeightBps_0),
                                  this._absDiff16_0(currentWeightB_0,
                                                    targetWeightBpsB_0));
    const goalA_0 = this._goalWeight_0(characterId_0,
                                       currentWeightA_0,
                                       targetWeightBps_0,
                                       allowedDriftBps_0);
    const goalB_0 = (__compactRuntime.assert(10000n >= goalA_0,
                                             'result of subtraction would be negative'),
                     10000n - goalA_0);
    __compactRuntime.assert(this._quotientIsValid_0(this._multiply64x16_0(totalValue_0,
                                                                          goalA_0),
                                                    10000n,
                                                    targetValueA_0,
                                                    targetValueARemainder_0),
                            'invalid asset A target value');
    __compactRuntime.assert(this._quotientIsValid_0(this._multiply64x16_0(totalValue_0,
                                                                          goalB_0),
                                                    10000n,
                                                    targetValueB_0,
                                                    targetValueBRemainder_0),
                            'invalid asset B target value');
    const movedValue_0 = this._min64_0(this._absDiff64_0(targetValueA_0,
                                                         valueA_0),
                                       this._absDiff64_0(targetValueB_0,
                                                         valueB_0));
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_7.toValue(5n),
                                                                  alignment: _descriptor_7.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_7.toValue(7n),
                                                                  alignment: _descriptor_7.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_3.toValue(tmp_0),
                                                                alignment: _descriptor_3.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    if (drift_0 <= allowedDriftBps_0
        ||
        movedValue_0 < this._minTradeValue_0(characterId_0)
        ||
        totalCost_0 >= movedValue_0)
    {
      const tmp_1 = this._none_0();
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(6n),
                                                                                                alignment: _descriptor_7.alignment() }).encode() } },
                                         { push: { storage: true,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tmp_1),
                                                                                                alignment: _descriptor_2.alignment() }).encode() } },
                                         { ins: { cached: false, n: 1 } }]);
      const tmp_2 = { decisionId: decisionId_0,
                      status: 3,
                      catalogVersion: 1n,
                      trustFormulaVersion: 1n,
                      circuitVersion: 1n,
                      sequence:
                        _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                  partialProofData,
                                                                                  [
                                                                                   { dup: { n: 0 } },
                                                                                   { idx: { cached: false,
                                                                                            pushPath: false,
                                                                                            path: [
                                                                                                   { tag: 'value',
                                                                                                     value: { value: _descriptor_7.toValue(7n),
                                                                                                              alignment: _descriptor_7.alignment() } }] } },
                                                                                   { popeq: { cached: true,
                                                                                              result: undefined } }]).value) };
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(8n),
                                                                                                alignment: _descriptor_7.alignment() }).encode() } },
                                         { push: { storage: true,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(tmp_2),
                                                                                                alignment: _descriptor_6.alignment() }).encode() } },
                                         { ins: { cached: false, n: 1 } }]);
    } else {
      let t_0;
      __compactRuntime.assert((t_0 = spent_0 + movedValue_0, t_0 <= budget_0),
                              'budget exceeded');
      const discretionBps_0 = ((t1) => {
                                if (t1 > 65535n) {
                                  throw new __compactRuntime.CompactError('CharacterMandate.compact line 518 char 27: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 65535');
                                }
                                return t1;
                              })(1000n + trustScore_0 * 90n);
      __compactRuntime.assert(this._quotientIsValid_0(this._multiply64x16_0(autoThreshold_0,
                                                                            discretionBps_0),
                                                      10000n,
                                                      effectiveCap_0,
                                                      effectiveCapRemainder_0),
                              'invalid effective cap');
      if (movedValue_0 <= effectiveCap_0) {
        const tmp_3 = this._none_0();
        __compactRuntime.queryLedgerState(context,
                                          partialProofData,
                                          [
                                           { push: { storage: false,
                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(6n),
                                                                                                  alignment: _descriptor_7.alignment() }).encode() } },
                                           { push: { storage: true,
                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tmp_3),
                                                                                                  alignment: _descriptor_2.alignment() }).encode() } },
                                           { ins: { cached: false, n: 1 } }]);
        const tmp_4 = { decisionId: decisionId_0,
                        status: 4,
                        catalogVersion: 1n,
                        trustFormulaVersion: 1n,
                        circuitVersion: 1n,
                        sequence:
                          _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                    partialProofData,
                                                                                    [
                                                                                     { dup: { n: 0 } },
                                                                                     { idx: { cached: false,
                                                                                              pushPath: false,
                                                                                              path: [
                                                                                                     { tag: 'value',
                                                                                                       value: { value: _descriptor_7.toValue(7n),
                                                                                                                alignment: _descriptor_7.alignment() } }] } },
                                                                                     { popeq: { cached: true,
                                                                                                result: undefined } }]).value) };
        __compactRuntime.queryLedgerState(context,
                                          partialProofData,
                                          [
                                           { push: { storage: false,
                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(8n),
                                                                                                  alignment: _descriptor_7.alignment() }).encode() } },
                                           { push: { storage: true,
                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(tmp_4),
                                                                                                  alignment: _descriptor_6.alignment() }).encode() } },
                                           { ins: { cached: false, n: 1 } }]);
      } else {
        const tmp_5 = this._some_0(decisionId_0);
        __compactRuntime.queryLedgerState(context,
                                          partialProofData,
                                          [
                                           { push: { storage: false,
                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(6n),
                                                                                                  alignment: _descriptor_7.alignment() }).encode() } },
                                           { push: { storage: true,
                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tmp_5),
                                                                                                  alignment: _descriptor_2.alignment() }).encode() } },
                                           { ins: { cached: false, n: 1 } }]);
        const tmp_6 = { decisionId: decisionId_0,
                        status: 5,
                        catalogVersion: 1n,
                        trustFormulaVersion: 1n,
                        circuitVersion: 1n,
                        sequence:
                          _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                    partialProofData,
                                                                                    [
                                                                                     { dup: { n: 0 } },
                                                                                     { idx: { cached: false,
                                                                                              pushPath: false,
                                                                                              path: [
                                                                                                     { tag: 'value',
                                                                                                       value: { value: _descriptor_7.toValue(7n),
                                                                                                                alignment: _descriptor_7.alignment() } }] } },
                                                                                     { popeq: { cached: true,
                                                                                                result: undefined } }]).value) };
        __compactRuntime.queryLedgerState(context,
                                          partialProofData,
                                          [
                                           { push: { storage: false,
                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(8n),
                                                                                                  alignment: _descriptor_7.alignment() }).encode() } },
                                           { push: { storage: true,
                                                     value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(tmp_6),
                                                                                                  alignment: _descriptor_6.alignment() }).encode() } },
                                           { ins: { cached: false, n: 1 } }]);
      }
    }
    return [];
  }
  _resolvePending_0(context, partialProofData, decisionId_0, approved_0) {
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_7.toValue(4n),
                                                                                                                  alignment: _descriptor_7.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value),
                            'relationship inactive');
    const version_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                partialProofData,
                                                                                [
                                                                                 { dup: { n: 0 } },
                                                                                 { idx: { cached: false,
                                                                                          pushPath: false,
                                                                                          path: [
                                                                                                 { tag: 'value',
                                                                                                   value: { value: _descriptor_7.toValue(3n),
                                                                                                            alignment: _descriptor_7.alignment() } }] } },
                                                                                 { popeq: { cached: true,
                                                                                            result: undefined } }]).value);
    __compactRuntime.assert(this._equal_20(this._computeOwnerCommitment_0(this._localOwnerSecret_0(context,
                                                                                                   partialProofData),
                                                                          version_0),
                                           _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                     partialProofData,
                                                                                                     [
                                                                                                      { dup: { n: 0 } },
                                                                                                      { idx: { cached: false,
                                                                                                               pushPath: false,
                                                                                                               path: [
                                                                                                                      { tag: 'value',
                                                                                                                        value: { value: _descriptor_7.toValue(0n),
                                                                                                                                 alignment: _descriptor_7.alignment() } }] } },
                                                                                                      { popeq: { cached: false,
                                                                                                                 result: undefined } }]).value)),
                            'owner authentication failed');
    __compactRuntime.assert(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_7.toValue(6n),
                                                                                                                  alignment: _descriptor_7.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value).is_some,
                            'no pending decision');
    __compactRuntime.assert(this._equal_21(_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                     partialProofData,
                                                                                                     [
                                                                                                      { dup: { n: 0 } },
                                                                                                      { idx: { cached: false,
                                                                                                               pushPath: false,
                                                                                                               path: [
                                                                                                                      { tag: 'value',
                                                                                                                        value: { value: _descriptor_7.toValue(6n),
                                                                                                                                 alignment: _descriptor_7.alignment() } }] } },
                                                                                                      { popeq: { cached: false,
                                                                                                                 result: undefined } }]).value).value,
                                           decisionId_0),
                            'pending decision mismatch');
    __compactRuntime.assert(_descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_7.toValue(8n),
                                                                                                                  alignment: _descriptor_7.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value).status
                            ===
                            5,
                            'decision already resolved');
    const tmp_0 = this._none_0();
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(6n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tmp_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_1 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_7.toValue(7n),
                                                                  alignment: _descriptor_7.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_3.toValue(tmp_1),
                                                                alignment: _descriptor_3.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    if (approved_0) {
      const tmp_2 = { decisionId: decisionId_0,
                      status: 6,
                      catalogVersion: 1n,
                      trustFormulaVersion: 1n,
                      circuitVersion: 1n,
                      sequence:
                        _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                  partialProofData,
                                                                                  [
                                                                                   { dup: { n: 0 } },
                                                                                   { idx: { cached: false,
                                                                                            pushPath: false,
                                                                                            path: [
                                                                                                   { tag: 'value',
                                                                                                     value: { value: _descriptor_7.toValue(7n),
                                                                                                              alignment: _descriptor_7.alignment() } }] } },
                                                                                   { popeq: { cached: true,
                                                                                              result: undefined } }]).value) };
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(8n),
                                                                                                alignment: _descriptor_7.alignment() }).encode() } },
                                         { push: { storage: true,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(tmp_2),
                                                                                                alignment: _descriptor_6.alignment() }).encode() } },
                                         { ins: { cached: false, n: 1 } }]);
    } else {
      const tmp_3 = { decisionId: decisionId_0,
                      status: 7,
                      catalogVersion: 1n,
                      trustFormulaVersion: 1n,
                      circuitVersion: 1n,
                      sequence:
                        _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                  partialProofData,
                                                                                  [
                                                                                   { dup: { n: 0 } },
                                                                                   { idx: { cached: false,
                                                                                            pushPath: false,
                                                                                            path: [
                                                                                                   { tag: 'value',
                                                                                                     value: { value: _descriptor_7.toValue(7n),
                                                                                                              alignment: _descriptor_7.alignment() } }] } },
                                                                                   { popeq: { cached: true,
                                                                                              result: undefined } }]).value) };
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(8n),
                                                                                                alignment: _descriptor_7.alignment() }).encode() } },
                                         { push: { storage: true,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(tmp_3),
                                                                                                alignment: _descriptor_6.alignment() }).encode() } },
                                         { ins: { cached: false, n: 1 } }]);
    }
    return [];
  }
  _recordRelationshipEvent_0(context,
                             partialProofData,
                             decisionId_0,
                             eventKind_0,
                             oldSpent_0,
                             oldTrustScore_0,
                             oldHistoryDigest_0,
                             relationshipNonce_0,
                             valueQuote_0,
                             frictionQuote_0,
                             operatingCost_0,
                             sourceDigest_0)
  {
    const MAX_VALUE_0 = 800000000000000n;
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_7.toValue(4n),
                                                                                                                  alignment: _descriptor_7.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value),
                            'relationship inactive');
    __compactRuntime.assert(eventKind_0 >= 1n && eventKind_0 <= 4n,
                            'unknown relationship event');
    __compactRuntime.assert(valueQuote_0 <= MAX_VALUE_0,
                            'event value out of range');
    __compactRuntime.assert(frictionQuote_0 <= MAX_VALUE_0
                            &&
                            operatingCost_0 <= MAX_VALUE_0,
                            'event cost out of range');
    const version_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                partialProofData,
                                                                                [
                                                                                 { dup: { n: 0 } },
                                                                                 { idx: { cached: false,
                                                                                          pushPath: false,
                                                                                          path: [
                                                                                                 { tag: 'value',
                                                                                                   value: { value: _descriptor_7.toValue(3n),
                                                                                                            alignment: _descriptor_7.alignment() } }] } },
                                                                                 { popeq: { cached: true,
                                                                                            result: undefined } }]).value);
    this._assertRelationship_0(context,
                               partialProofData,
                               this._localOwnerSecret_0(context,
                                                        partialProofData),
                               oldSpent_0,
                               oldTrustScore_0,
                               oldHistoryDigest_0,
                               relationshipNonce_0,
                               version_0);
    const key_0 = this._decisionKey_0(decisionId_0, version_0);
    const decisionWasUsed_0 = _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                        partialProofData,
                                                                                        [
                                                                                         { dup: { n: 0 } },
                                                                                         { idx: { cached: false,
                                                                                                  pushPath: false,
                                                                                                  path: [
                                                                                                         { tag: 'value',
                                                                                                           value: { value: _descriptor_7.toValue(5n),
                                                                                                                    alignment: _descriptor_7.alignment() } }] } },
                                                                                         { push: { storage: false,
                                                                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(key_0),
                                                                                                                                                alignment: _descriptor_1.alignment() }).encode() } },
                                                                                         'member',
                                                                                         { popeq: { cached: true,
                                                                                                    result: undefined } }]).value);
    __compactRuntime.assert(this._equal_22(eventKind_0, 3n)
                            &&
                            !decisionWasUsed_0
                            ||
                            !this._equal_23(eventKind_0, 3n)
                            &&
                            decisionWasUsed_0,
                            'relationship event decision mismatch');
    const lastDecisionMatches_0 = this._equal_24(_descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                           partialProofData,
                                                                                                           [
                                                                                                            { dup: { n: 0 } },
                                                                                                            { idx: { cached: false,
                                                                                                                     pushPath: false,
                                                                                                                     path: [
                                                                                                                            { tag: 'value',
                                                                                                                              value: { value: _descriptor_7.toValue(8n),
                                                                                                                                       alignment: _descriptor_7.alignment() } }] } },
                                                                                                            { popeq: { cached: false,
                                                                                                                       result: undefined } }]).value).decisionId,
                                                 decisionId_0);
    const lastWasAutoEligible_0 = _descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                            partialProofData,
                                                                                            [
                                                                                             { dup: { n: 0 } },
                                                                                             { idx: { cached: false,
                                                                                                      pushPath: false,
                                                                                                      path: [
                                                                                                             { tag: 'value',
                                                                                                               value: { value: _descriptor_7.toValue(8n),
                                                                                                                        alignment: _descriptor_7.alignment() } }] } },
                                                                                             { popeq: { cached: false,
                                                                                                        result: undefined } }]).value).status
                                  ===
                                  4;
    const lastWasOwnerApproved_0 = _descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                             partialProofData,
                                                                                             [
                                                                                              { dup: { n: 0 } },
                                                                                              { idx: { cached: false,
                                                                                                       pushPath: false,
                                                                                                       path: [
                                                                                                              { tag: 'value',
                                                                                                                value: { value: _descriptor_7.toValue(8n),
                                                                                                                         alignment: _descriptor_7.alignment() } }] } },
                                                                                              { popeq: { cached: false,
                                                                                                         result: undefined } }]).value).status
                                   ===
                                   6;
    const lastWasOwnerRejected_0 = _descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                             partialProofData,
                                                                                             [
                                                                                              { dup: { n: 0 } },
                                                                                              { idx: { cached: false,
                                                                                                       pushPath: false,
                                                                                                       path: [
                                                                                                              { tag: 'value',
                                                                                                                value: { value: _descriptor_7.toValue(8n),
                                                                                                                         alignment: _descriptor_7.alignment() } }] } },
                                                                                              { popeq: { cached: false,
                                                                                                         result: undefined } }]).value).status
                                   ===
                                   7;
    const executionIsEligible_0 = lastDecisionMatches_0
                                  &&
                                  (lastWasAutoEligible_0
                                   ||
                                   lastWasOwnerApproved_0);
    const decisionWasRejected_0 = lastDecisionMatches_0
                                  &&
                                  lastWasOwnerRejected_0;
    __compactRuntime.assert(!this._equal_25(eventKind_0, 1n)
                            ||
                            executionIsEligible_0,
                            'execution not eligible');
    __compactRuntime.assert(!this._equal_26(eventKind_0, 2n)
                            ||
                            decisionWasRejected_0,
                            'decision not rejected');
    const relationshipEventKey_0 = this._eventKey_0(decisionId_0,
                                                    eventKind_0,
                                                    version_0);
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_7.toValue(5n),
                                                                                                                   alignment: _descriptor_7.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(relationshipEventKey_0),
                                                                                                                                               alignment: _descriptor_1.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'relationship event already used');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_7.toValue(5n),
                                                                  alignment: _descriptor_7.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(relationshipEventKey_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const newTrustScore_0 = this._computeTrustAfterEvent_0(oldTrustScore_0,
                                                           eventKind_0,
                                                           valueQuote_0,
                                                           frictionQuote_0,
                                                           operatingCost_0);
    const newSpent_0 = this._spentAfterEvent_0(oldSpent_0,
                                               eventKind_0,
                                               valueQuote_0);
    __compactRuntime.assert(newSpent_0 <= 1600000000000000n,
                            'relationship spend out of range');
    const newHistoryDigest_0 = this._computeHistoryAfter_0(oldHistoryDigest_0,
                                                           decisionId_0,
                                                           eventKind_0,
                                                           sourceDigest_0,
                                                           newTrustScore_0,
                                                           newSpent_0);
    const tmp_0 = this._computeRelationshipCommitment_0(_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                                  partialProofData,
                                                                                                                  [
                                                                                                                   { dup: { n: 0 } },
                                                                                                                   { idx: { cached: false,
                                                                                                                            pushPath: false,
                                                                                                                            path: [
                                                                                                                                   { tag: 'value',
                                                                                                                                     value: { value: _descriptor_7.toValue(0n),
                                                                                                                                              alignment: _descriptor_7.alignment() } }] } },
                                                                                                                   { popeq: { cached: false,
                                                                                                                              result: undefined } }]).value),
                                                        _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                                  partialProofData,
                                                                                                                  [
                                                                                                                   { dup: { n: 0 } },
                                                                                                                   { idx: { cached: false,
                                                                                                                            pushPath: false,
                                                                                                                            path: [
                                                                                                                                   { tag: 'value',
                                                                                                                                     value: { value: _descriptor_7.toValue(1n),
                                                                                                                                              alignment: _descriptor_7.alignment() } }] } },
                                                                                                                   { popeq: { cached: false,
                                                                                                                              result: undefined } }]).value),
                                                        newSpent_0,
                                                        newTrustScore_0,
                                                        newHistoryDigest_0,
                                                        relationshipNonce_0,
                                                        version_0);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(2n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tmp_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_1 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_7.toValue(7n),
                                                                  alignment: _descriptor_7.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_3.toValue(tmp_1),
                                                                alignment: _descriptor_3.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_2 = { decisionId: decisionId_0,
                    status: 8,
                    catalogVersion: 1n,
                    trustFormulaVersion: 1n,
                    circuitVersion: 1n,
                    sequence:
                      _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                partialProofData,
                                                                                [
                                                                                 { dup: { n: 0 } },
                                                                                 { idx: { cached: false,
                                                                                          pushPath: false,
                                                                                          path: [
                                                                                                 { tag: 'value',
                                                                                                   value: { value: _descriptor_7.toValue(7n),
                                                                                                            alignment: _descriptor_7.alignment() } }] } },
                                                                                 { popeq: { cached: true,
                                                                                            result: undefined } }]).value) };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(8n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(tmp_2),
                                                                                              alignment: _descriptor_6.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _revokeRelationship_0(context, partialProofData) {
    __compactRuntime.assert(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_7.toValue(4n),
                                                                                                                  alignment: _descriptor_7.alignment() } }] } },
                                                                                       { popeq: { cached: false,
                                                                                                  result: undefined } }]).value),
                            'relationship inactive');
    const version_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                partialProofData,
                                                                                [
                                                                                 { dup: { n: 0 } },
                                                                                 { idx: { cached: false,
                                                                                          pushPath: false,
                                                                                          path: [
                                                                                                 { tag: 'value',
                                                                                                   value: { value: _descriptor_7.toValue(3n),
                                                                                                            alignment: _descriptor_7.alignment() } }] } },
                                                                                 { popeq: { cached: true,
                                                                                            result: undefined } }]).value);
    __compactRuntime.assert(this._equal_27(this._computeOwnerCommitment_0(this._localOwnerSecret_0(context,
                                                                                                   partialProofData),
                                                                          version_0),
                                           _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                     partialProofData,
                                                                                                     [
                                                                                                      { dup: { n: 0 } },
                                                                                                      { idx: { cached: false,
                                                                                                               pushPath: false,
                                                                                                               path: [
                                                                                                                      { tag: 'value',
                                                                                                                        value: { value: _descriptor_7.toValue(0n),
                                                                                                                                 alignment: _descriptor_7.alignment() } }] } },
                                                                                                      { popeq: { cached: false,
                                                                                                                 result: undefined } }]).value)),
                            'owner authentication failed');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(4n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(false),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_0 = this._none_0();
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(6n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(tmp_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_1 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_7.toValue(7n),
                                                                  alignment: _descriptor_7.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_3.toValue(tmp_1),
                                                                alignment: _descriptor_3.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_2 = { decisionId:
                      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                    status: 2,
                    catalogVersion: 1n,
                    trustFormulaVersion: 1n,
                    circuitVersion: 1n,
                    sequence:
                      _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                partialProofData,
                                                                                [
                                                                                 { dup: { n: 0 } },
                                                                                 { idx: { cached: false,
                                                                                          pushPath: false,
                                                                                          path: [
                                                                                                 { tag: 'value',
                                                                                                   value: { value: _descriptor_7.toValue(7n),
                                                                                                            alignment: _descriptor_7.alignment() } }] } },
                                                                                 { popeq: { cached: true,
                                                                                            result: undefined } }]).value) };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_7.toValue(8n),
                                                                                              alignment: _descriptor_7.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_6.toValue(tmp_2),
                                                                                              alignment: _descriptor_6.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _equal_0(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_1(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_2(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_3(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_4(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_5(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_6(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_7(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_8(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_9(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_10(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_11(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_12(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_13(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_14(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_15(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_16(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_17(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_18(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_19(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_20(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_21(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_22(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_23(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_24(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_25(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_26(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_27(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    get ownerCommitment() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_7.toValue(0n),
                                                                                                   alignment: _descriptor_7.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get mandateCommitment() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_7.toValue(1n),
                                                                                                   alignment: _descriptor_7.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get relationshipCommitment() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_7.toValue(2n),
                                                                                                   alignment: _descriptor_7.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get mandateVersion() {
      return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_7.toValue(3n),
                                                                                                   alignment: _descriptor_7.alignment() } }] } },
                                                                        { popeq: { cached: true,
                                                                                   result: undefined } }]).value);
    },
    get active() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_7.toValue(4n),
                                                                                                   alignment: _descriptor_7.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    usedDecisionIds: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_7.toValue(5n),
                                                                                                     alignment: _descriptor_7.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(0n),
                                                                                                                                 alignment: _descriptor_5.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_7.toValue(5n),
                                                                                                     alignment: _descriptor_7.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'CharacterMandate.compact line 31 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_7.toValue(5n),
                                                                                                     alignment: _descriptor_7.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[5];
        return self_0.asMap().keys().map((elem) => _descriptor_1.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    get pendingDecisionId() {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_7.toValue(6n),
                                                                                                   alignment: _descriptor_7.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get receiptSequence() {
      return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_7.toValue(7n),
                                                                                                   alignment: _descriptor_7.alignment() } }] } },
                                                                        { popeq: { cached: true,
                                                                                   result: undefined } }]).value);
    },
    get lastReceipt() {
      return _descriptor_6.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_7.toValue(8n),
                                                                                                   alignment: _descriptor_7.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  localOwnerSecret: (...args) => undefined
});
export const pureCircuits = {
  computeOwnerCommitment: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`computeOwnerCommitment: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const ownerSecret_0 = args_0[0];
    const version_0 = args_0[1];
    if (!(ownerSecret_0.buffer instanceof ArrayBuffer && ownerSecret_0.BYTES_PER_ELEMENT === 1 && ownerSecret_0.length === 32)) {
      __compactRuntime.typeError('computeOwnerCommitment',
                                 'argument 1',
                                 'CharacterMandate.compact line 38 char 1',
                                 'Bytes<32>',
                                 ownerSecret_0)
    }
    if (!(typeof(version_0) === 'bigint' && version_0 >= 0n && version_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('computeOwnerCommitment',
                                 'argument 2',
                                 'CharacterMandate.compact line 38 char 1',
                                 'Uint<0..18446744073709551616>',
                                 version_0)
    }
    return _dummyContract._computeOwnerCommitment_0(ownerSecret_0, version_0);
  },
  computeMandateCommitment: (...args_0) => {
    if (args_0.length !== 8) {
      throw new __compactRuntime.CompactError(`computeMandateCommitment: expected 8 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const characterId_0 = args_0[0];
    const targetWeightBps_0 = args_0[1];
    const allowedDriftBps_0 = args_0[2];
    const autoThreshold_0 = args_0[3];
    const budget_0 = args_0[4];
    const expiry_0 = args_0[5];
    const nonce_0 = args_0[6];
    const version_0 = args_0[7];
    if (!(typeof(characterId_0) === 'bigint' && characterId_0 >= 0n && characterId_0 <= 255n)) {
      __compactRuntime.typeError('computeMandateCommitment',
                                 'argument 1',
                                 'CharacterMandate.compact line 49 char 1',
                                 'Uint<0..256>',
                                 characterId_0)
    }
    if (!(typeof(targetWeightBps_0) === 'bigint' && targetWeightBps_0 >= 0n && targetWeightBps_0 <= 65535n)) {
      __compactRuntime.typeError('computeMandateCommitment',
                                 'argument 2',
                                 'CharacterMandate.compact line 49 char 1',
                                 'Uint<0..65536>',
                                 targetWeightBps_0)
    }
    if (!(typeof(allowedDriftBps_0) === 'bigint' && allowedDriftBps_0 >= 0n && allowedDriftBps_0 <= 65535n)) {
      __compactRuntime.typeError('computeMandateCommitment',
                                 'argument 3',
                                 'CharacterMandate.compact line 49 char 1',
                                 'Uint<0..65536>',
                                 allowedDriftBps_0)
    }
    if (!(typeof(autoThreshold_0) === 'bigint' && autoThreshold_0 >= 0n && autoThreshold_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('computeMandateCommitment',
                                 'argument 4',
                                 'CharacterMandate.compact line 49 char 1',
                                 'Uint<0..18446744073709551616>',
                                 autoThreshold_0)
    }
    if (!(typeof(budget_0) === 'bigint' && budget_0 >= 0n && budget_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('computeMandateCommitment',
                                 'argument 5',
                                 'CharacterMandate.compact line 49 char 1',
                                 'Uint<0..18446744073709551616>',
                                 budget_0)
    }
    if (!(typeof(expiry_0) === 'bigint' && expiry_0 >= 0n && expiry_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('computeMandateCommitment',
                                 'argument 6',
                                 'CharacterMandate.compact line 49 char 1',
                                 'Uint<0..18446744073709551616>',
                                 expiry_0)
    }
    if (!(nonce_0.buffer instanceof ArrayBuffer && nonce_0.BYTES_PER_ELEMENT === 1 && nonce_0.length === 32)) {
      __compactRuntime.typeError('computeMandateCommitment',
                                 'argument 7',
                                 'CharacterMandate.compact line 49 char 1',
                                 'Bytes<32>',
                                 nonce_0)
    }
    if (!(typeof(version_0) === 'bigint' && version_0 >= 0n && version_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('computeMandateCommitment',
                                 'argument 8',
                                 'CharacterMandate.compact line 49 char 1',
                                 'Uint<0..18446744073709551616>',
                                 version_0)
    }
    return _dummyContract._computeMandateCommitment_0(characterId_0,
                                                      targetWeightBps_0,
                                                      allowedDriftBps_0,
                                                      autoThreshold_0,
                                                      budget_0,
                                                      expiry_0,
                                                      nonce_0,
                                                      version_0);
  },
  computeRelationshipCommitment: (...args_0) => {
    if (args_0.length !== 7) {
      throw new __compactRuntime.CompactError(`computeRelationshipCommitment: expected 7 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const ownerHash_0 = args_0[0];
    const mandateHash_0 = args_0[1];
    const spent_0 = args_0[2];
    const trustScore_0 = args_0[3];
    const historyDigest_0 = args_0[4];
    const relationshipNonce_0 = args_0[5];
    const version_0 = args_0[6];
    if (!(ownerHash_0.buffer instanceof ArrayBuffer && ownerHash_0.BYTES_PER_ELEMENT === 1 && ownerHash_0.length === 32)) {
      __compactRuntime.typeError('computeRelationshipCommitment',
                                 'argument 1',
                                 'CharacterMandate.compact line 72 char 1',
                                 'Bytes<32>',
                                 ownerHash_0)
    }
    if (!(mandateHash_0.buffer instanceof ArrayBuffer && mandateHash_0.BYTES_PER_ELEMENT === 1 && mandateHash_0.length === 32)) {
      __compactRuntime.typeError('computeRelationshipCommitment',
                                 'argument 2',
                                 'CharacterMandate.compact line 72 char 1',
                                 'Bytes<32>',
                                 mandateHash_0)
    }
    if (!(typeof(spent_0) === 'bigint' && spent_0 >= 0n && spent_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('computeRelationshipCommitment',
                                 'argument 3',
                                 'CharacterMandate.compact line 72 char 1',
                                 'Uint<0..18446744073709551616>',
                                 spent_0)
    }
    if (!(typeof(trustScore_0) === 'bigint' && trustScore_0 >= 0n && trustScore_0 <= 255n)) {
      __compactRuntime.typeError('computeRelationshipCommitment',
                                 'argument 4',
                                 'CharacterMandate.compact line 72 char 1',
                                 'Uint<0..256>',
                                 trustScore_0)
    }
    if (!(historyDigest_0.buffer instanceof ArrayBuffer && historyDigest_0.BYTES_PER_ELEMENT === 1 && historyDigest_0.length === 32)) {
      __compactRuntime.typeError('computeRelationshipCommitment',
                                 'argument 5',
                                 'CharacterMandate.compact line 72 char 1',
                                 'Bytes<32>',
                                 historyDigest_0)
    }
    if (!(relationshipNonce_0.buffer instanceof ArrayBuffer && relationshipNonce_0.BYTES_PER_ELEMENT === 1 && relationshipNonce_0.length === 32)) {
      __compactRuntime.typeError('computeRelationshipCommitment',
                                 'argument 6',
                                 'CharacterMandate.compact line 72 char 1',
                                 'Bytes<32>',
                                 relationshipNonce_0)
    }
    if (!(typeof(version_0) === 'bigint' && version_0 >= 0n && version_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('computeRelationshipCommitment',
                                 'argument 7',
                                 'CharacterMandate.compact line 72 char 1',
                                 'Uint<0..18446744073709551616>',
                                 version_0)
    }
    return _dummyContract._computeRelationshipCommitment_0(ownerHash_0,
                                                           mandateHash_0,
                                                           spent_0,
                                                           trustScore_0,
                                                           historyDigest_0,
                                                           relationshipNonce_0,
                                                           version_0);
  },
  computeHistoryAfter: (...args_0) => {
    if (args_0.length !== 6) {
      throw new __compactRuntime.CompactError(`computeHistoryAfter: expected 6 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const previous_0 = args_0[0];
    const decisionId_0 = args_0[1];
    const eventKind_0 = args_0[2];
    const sourceDigest_0 = args_0[3];
    const newTrustScore_0 = args_0[4];
    const newSpent_0 = args_0[5];
    if (!(previous_0.buffer instanceof ArrayBuffer && previous_0.BYTES_PER_ELEMENT === 1 && previous_0.length === 32)) {
      __compactRuntime.typeError('computeHistoryAfter',
                                 'argument 1',
                                 'CharacterMandate.compact line 110 char 1',
                                 'Bytes<32>',
                                 previous_0)
    }
    if (!(decisionId_0.buffer instanceof ArrayBuffer && decisionId_0.BYTES_PER_ELEMENT === 1 && decisionId_0.length === 32)) {
      __compactRuntime.typeError('computeHistoryAfter',
                                 'argument 2',
                                 'CharacterMandate.compact line 110 char 1',
                                 'Bytes<32>',
                                 decisionId_0)
    }
    if (!(typeof(eventKind_0) === 'bigint' && eventKind_0 >= 0n && eventKind_0 <= 255n)) {
      __compactRuntime.typeError('computeHistoryAfter',
                                 'argument 3',
                                 'CharacterMandate.compact line 110 char 1',
                                 'Uint<0..256>',
                                 eventKind_0)
    }
    if (!(sourceDigest_0.buffer instanceof ArrayBuffer && sourceDigest_0.BYTES_PER_ELEMENT === 1 && sourceDigest_0.length === 32)) {
      __compactRuntime.typeError('computeHistoryAfter',
                                 'argument 4',
                                 'CharacterMandate.compact line 110 char 1',
                                 'Bytes<32>',
                                 sourceDigest_0)
    }
    if (!(typeof(newTrustScore_0) === 'bigint' && newTrustScore_0 >= 0n && newTrustScore_0 <= 255n)) {
      __compactRuntime.typeError('computeHistoryAfter',
                                 'argument 5',
                                 'CharacterMandate.compact line 110 char 1',
                                 'Uint<0..256>',
                                 newTrustScore_0)
    }
    if (!(typeof(newSpent_0) === 'bigint' && newSpent_0 >= 0n && newSpent_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('computeHistoryAfter',
                                 'argument 6',
                                 'CharacterMandate.compact line 110 char 1',
                                 'Uint<0..18446744073709551616>',
                                 newSpent_0)
    }
    return _dummyContract._computeHistoryAfter_0(previous_0,
                                                 decisionId_0,
                                                 eventKind_0,
                                                 sourceDigest_0,
                                                 newTrustScore_0,
                                                 newSpent_0);
  },
  computeTrustAfterEvent: (...args_0) => {
    if (args_0.length !== 5) {
      throw new __compactRuntime.CompactError(`computeTrustAfterEvent: expected 5 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const oldTrustScore_0 = args_0[0];
    const eventKind_0 = args_0[1];
    const valueQuote_0 = args_0[2];
    const frictionQuote_0 = args_0[3];
    const operatingCost_0 = args_0[4];
    if (!(typeof(oldTrustScore_0) === 'bigint' && oldTrustScore_0 >= 0n && oldTrustScore_0 <= 255n)) {
      __compactRuntime.typeError('computeTrustAfterEvent',
                                 'argument 1',
                                 'CharacterMandate.compact line 266 char 1',
                                 'Uint<0..256>',
                                 oldTrustScore_0)
    }
    if (!(typeof(eventKind_0) === 'bigint' && eventKind_0 >= 0n && eventKind_0 <= 255n)) {
      __compactRuntime.typeError('computeTrustAfterEvent',
                                 'argument 2',
                                 'CharacterMandate.compact line 266 char 1',
                                 'Uint<0..256>',
                                 eventKind_0)
    }
    if (!(typeof(valueQuote_0) === 'bigint' && valueQuote_0 >= 0n && valueQuote_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('computeTrustAfterEvent',
                                 'argument 3',
                                 'CharacterMandate.compact line 266 char 1',
                                 'Uint<0..18446744073709551616>',
                                 valueQuote_0)
    }
    if (!(typeof(frictionQuote_0) === 'bigint' && frictionQuote_0 >= 0n && frictionQuote_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('computeTrustAfterEvent',
                                 'argument 4',
                                 'CharacterMandate.compact line 266 char 1',
                                 'Uint<0..18446744073709551616>',
                                 frictionQuote_0)
    }
    if (!(typeof(operatingCost_0) === 'bigint' && operatingCost_0 >= 0n && operatingCost_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('computeTrustAfterEvent',
                                 'argument 5',
                                 'CharacterMandate.compact line 266 char 1',
                                 'Uint<0..18446744073709551616>',
                                 operatingCost_0)
    }
    return _dummyContract._computeTrustAfterEvent_0(oldTrustScore_0,
                                                    eventKind_0,
                                                    valueQuote_0,
                                                    frictionQuote_0,
                                                    operatingCost_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
//# sourceMappingURL=index.js.map
