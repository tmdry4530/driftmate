import { useMemo, useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { stringToHex, type Hex } from 'viem'
import type { CharacterId, Narration, PendingView } from '@soon/shared'
import { characterOf, computeTrust } from '@soon/engine'
import {
  NOT_EXECUTED_REASON,
  strategyHash,
  SUPPORTED_TRUST_FORMULA_VERSION,
  templateNarration,
} from '@soon/keeper'
import type { AppConfig } from './config.js'
import { evaluateGuard } from './chainGuard.js'
import { viewOf } from './characters.js'
import { computePerformance } from './performance.js'
import { currentKeeperStatus, deriveAgentState } from './characterState.js'
import { sameDelegation } from './delegationDraft.js'
import { live2dLoader } from './live2d.js'
import { useVault, vaultAbiParsed } from './hooks/useVault.js'
import { useKeeperApi } from './hooks/useKeeperApi.js'
import { WalletBar } from './components/WalletBar.js'
import { CharacterPicker } from './components/CharacterPicker.js'
import { CharacterStage } from './components/CharacterStage.js'
import { DelegationForm, type DelegationDraft } from './components/DelegationForm.js'
import { PerformancePanel } from './components/PerformancePanel.js'
import { TrackRecordList } from './components/TrackRecordList.js'
import { ApprovalQueue } from './components/ApprovalQueue.js'
import { TrustPanel } from './components/TrustPanel.js'
import { DelegationStatus } from './components/DelegationStatus.js'
import { LossReportPanel } from './components/LossReportPanel.js'

export function App({ config, keeperUrl }: { config: AppConfig; keeperUrl: string | undefined }) {
  const { address, isConnected, chainId } = useAccount()
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>('timid')
  const { state, error, refresh } = useVault(config)
  const keeper = useKeeperApi(keeperUrl)
  const client = usePublicClient()
  const { writeContractAsync, isPending } = useWriteContract()
  const [txError, setTxError] = useState<string | undefined>()
  const [failedDecisionId, setFailedDecisionId] = useState<string | undefined>()

  const guard = evaluateGuard({
    address: isConnected ? address : undefined,
    connectedChainId: isConnected ? chainId : undefined,
    expectedChainId: config.chainId,
    expectedChainName: config.chainName,
  })
  const character = state.active && state.delegation?.characterId
    ? state.delegation.characterId
    : selectedCharacter
  const view = viewOf(character)
  const records = useMemo(
    () => state.records.filter((record) => record.characterId === character),
    [state.records, character],
  )
  const trust = useMemo(
    () => computeTrust(state.records, character, SUPPORTED_TRUST_FORMULA_VERSION),
    [state.records, character],
  )
  const performance = useMemo(() => computePerformance(state.records, character), [state.records, character])
  const status = currentKeeperStatus(keeper.online ? keeper.status : undefined, {
    delegationId: state.delegationId,
    configHash: state.configHash,
    stateNonce: state.stateNonce,
    pending: state.pending,
    records: state.records,
  })
  const lossReport = status?.lossReport
  const userDisappointed = Boolean(
    lossReport &&
    state.records.some(
      (record) =>
        record.kind === 'disappointed' &&
        record.delegationId === state.delegationId &&
        record.reportId.toLowerCase() === lossReport.reportId.toLowerCase(),
    ),
  )
  const latestExecuted = records
    .filter((record) => record.kind === 'executed' && record.delegationId === state.delegationId)
    .at(-1)
  const agentState = status
    ? deriveAgentState(status, userDisappointed)
    : latestExecuted
      ? { kind: 'executed' as const }
      : { kind: 'idle' as const }

  const latestDecided = records
    .filter((record) => record.kind === 'decided' && record.delegationId === state.delegationId)
    .at(-1)
  const fallbackNarration: Narration | undefined =
    latestDecided?.kind === 'decided' && latestDecided.evidence
      ? {
          text: templateNarration({
            ...latestDecided.evidence,
            outcome: latestExecuted?.kind === 'executed' && latestExecuted.decisionId === latestDecided.decisionId
              ? 'executed'
              : latestDecided.evidence.outcome,
          }),
          fallback: true,
        }
      : undefined
  const narration = status?.narration ?? fallbackNarration
  const pending = status?.pending ? [status.pending] : []

  /** Refresh chain and keeper state only after receipt confirmation and optional verification. */
  async function send(
    fn: () => Promise<Hex>,
    what: string,
    afterReceipt?: (blockNumber: bigint) => Promise<void>,
  ): Promise<boolean> {
    setTxError(undefined)
    try {
      if (!client) throw new Error('The chain connection is not ready.')
      const hash = await fn()
      const receipt = await client.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('The transaction was reverted.')
      await afterReceipt?.(receipt.blockNumber)
      await Promise.all([refresh(), keeper.refresh()])
      return true
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setTxError(`${what} failed: ${message.split('\n')[0]}`)
      return false
    }
  }

  async function submitDelegation(draft: DelegationDraft) {
    if (!client) throw new Error('The chain connection is not ready.')
    const now = (await client.getBlock()).timestamp
    const delegation = {
      executor: config.executor,
      characterId: stringToHex(selectedCharacter, { size: 32 }),
      strategyHash: strategyHash(characterOf(selectedCharacter)),
      trustFormulaVersion: SUPPORTED_TRUST_FORMULA_VERSION,
      quoteAsset: config.quote,
      maxTradeValue: draft.maxTradeValue,
      autoThreshold: draft.autoThreshold,
      budget: draft.budget,
      operatingCap: draft.operatingCap,
      expiry: now + BigInt(draft.days) * 86_400n,
      approvalTtlSeconds: draft.approvalTtlSeconds,
      slippageToleranceBps: draft.slippageToleranceBps,
      targetAsset: config.token,
      targetAssetBps: draft.tokenWeightBps,
      allowedAssets: [config.token, config.quote],
      allowedDexes: [config.dex],
    } as const
    await send(
      () => writeContractAsync({
        address: config.vault,
        abi: vaultAbiParsed,
        functionName: 'setDelegation',
        args: [delegation],
      }),
      'Delegation setup',
      async (blockNumber) => {
        const stored = await client.readContract({
          address: config.vault,
          abi: vaultAbiParsed,
          functionName: 'delegation',
          blockNumber,
        })
        if (!sameDelegation(delegation, stored)) throw new Error('The signed delegation does not match the on-chain value.')
      },
    )
  }

  async function approve(pending: PendingView) {
    const ok = await send(
      () => writeContractAsync({
        address: config.vault,
        abi: vaultAbiParsed,
        functionName: 'executeApproved',
        args: [
          BigInt(pending.delegationId),
          BigInt(pending.stateNonce),
          pending.decisionId,
          { dex: pending.dex, ...pending.trade },
        ],
      }),
      'Approved execution',
    )
    setFailedDecisionId(ok ? undefined : pending.decisionId)
  }

  function reject(pending: PendingView) {
    return send(
      () => writeContractAsync({
        address: config.vault,
        abi: vaultAbiParsed,
        functionName: 'reject',
        args: [BigInt(pending.delegationId), BigInt(pending.stateNonce), pending.decisionId],
      }),
      'Approval rejection',
    )
  }

  function expire(pending: PendingView) {
    return send(
      () => writeContractAsync({
        address: config.vault,
        abi: vaultAbiParsed,
        functionName: 'expire',
        args: [BigInt(pending.delegationId), BigInt(pending.stateNonce), pending.decisionId],
      }),
      'Approval expiry',
    )
  }

  function finalizeFailure(pending: PendingView) {
    return send(
      () => writeContractAsync({
        address: config.vault,
        abi: vaultAbiParsed,
        functionName: 'finalizePendingFailure',
        args: [
          BigInt(pending.delegationId),
          BigInt(pending.stateNonce),
          pending.decisionId,
          NOT_EXECUTED_REASON.execution_failed,
        ],
      }),
      'Failure finalization',
    )
  }

  function signalDisappointment() {
    if (!lossReport || lossReport.status !== 'loss') return Promise.resolve(false)
    return send(
      () => writeContractAsync({
        address: config.vault,
        abi: vaultAbiParsed,
        functionName: 'signalDisappointment',
        args: [BigInt(lossReport.delegationId), lossReport.reportId],
      }),
      'Disappointment signal',
    )
  }

  function revokeDelegation() {
    return send(
      () => writeContractAsync({
        address: config.vault,
        abi: vaultAbiParsed,
        functionName: 'revoke',
        args: [],
      }),
      'Delegation revocation',
    )
  }

  return (
    <div className="app">
      <WalletBar config={config} />

      {error && <div className="notice" style={{ marginBottom: 16 }}>{error}</div>}
      {txError && <div className="notice" style={{ marginBottom: 16 }}>{txError}</div>}
      {keeperUrl && !keeper.online && (
        <div className="notice" style={{ marginBottom: 16 }}>
          The keeper is offline. Only confirmed on-chain records are shown; automatic decision state is not inferred.
        </div>
      )}
      {status?.lastError && <div className="notice" style={{ marginBottom: 16 }}>{status.lastError}</div>}

      <div className="grid">
        <div>
          <CharacterPicker selected={character} onSelect={setSelectedCharacter} locked={state.active} />
          {!state.active && (
            <DelegationForm
              tokenSymbol="TOKEN"
              quoteSymbol="USDC"
              tokenAddress={config.token}
              quoteAddress={config.quote}
              characterName={view.name}
              strategyHash={strategyHash(characterOf(selectedCharacter))}
              trustFormulaVersion={SUPPORTED_TRUST_FORMULA_VERSION}
              executor={config.executor}
              dex={config.dex}
              onSubmit={(draft) => void submitDelegation(draft)}
              disabled={!guard.canExecute || isPending}
            />
          )}
          {state.active && (
            <DelegationStatus
              budget={state.delegation?.budget}
              budgetSpent={state.budgetSpent}
              operatingCap={state.delegation?.operatingCap}
              operatingSpent={state.operatingSpent}
              expiry={state.delegation?.expiry}
              onRevoke={() => void revokeDelegation()}
              canRevoke={guard.canExecute}
              busy={isPending}
            />
          )}
          {state.active && (
            <TrustPanel
              trust={trust}
              autoThreshold={state.delegation?.autoThreshold}
              onDisappoint={() => void signalDisappointment()}
              canDisappoint={guard.canExecute && lossReport?.status === 'loss' && !userDisappointed}
              busy={isPending}
            />
          )}
        </div>

        <div>
          <LossReportPanel report={lossReport} />
          <CharacterStage
            state={agentState}
            characterId={character}
            characterName={view.name}
            narration={narration}
            loader={live2dLoader}
          />
          <ApprovalQueue
            items={pending}
            currentTimestamp={state.blockTimestamp}
            onApprove={(item) => void approve(item)}
            onReject={(item) => void reject(item)}
            onExpire={(item) => void expire(item)}
            onFinalizeFailure={(item) => void finalizeFailure(item)}
            failedDecisionId={failedDecisionId}
            canAct={guard.canExecute}
            busy={isPending}
          />
          <PerformancePanel p={performance} />
          <TrackRecordList records={records} explorerBase={config.explorerUrl} />
        </div>
      </div>
    </div>
  )
}
