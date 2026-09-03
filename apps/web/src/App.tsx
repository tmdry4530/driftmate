import { useMemo, useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import type { CharacterId, Narration } from '@soon/shared'
import { computeTrust } from '@soon/engine'
import type { AppConfig } from './config.js'
import { evaluateGuard } from './chainGuard.js'
import { viewOf } from './characters.js'
import { computePerformance } from './performance.js'
import type { AgentState } from './characterState.js'
import { templateNarration } from './narrator/narrate.js'
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

export function App({ config, keeperUrl }: { config: AppConfig; keeperUrl: string | undefined }) {
  const { address, isConnected, chainId } = useAccount()
  const [character, setCharacter] = useState<CharacterId>('timid')
  const { state, error, refresh } = useVault(config)
  const keeper = useKeeperApi(keeperUrl)
  const { writeContractAsync, isPending } = useWriteContract()
  const [txError, setTxError] = useState<string | undefined>()

  const guard = evaluateGuard({
    address: isConnected ? address : undefined,
    connectedChainId: isConnected ? chainId : undefined,
    expectedChainId: config.chainId,
    expectedChainName: config.chainName,
  })

  const trust = useMemo(() => computeTrust(state.records), [state.records])
  const perf = useMemo(() => computePerformance(state.records), [state.records])
  const view = viewOf(character)

  const latest = state.records.filter((r) => r.kind === 'executed').at(-1)

  // 손익 표시는 아직 하지 않는다. 예치 시점 가격이 어디에도 기록되지 않아
  // 포트폴리오 손익을 정직하게 계산할 방법이 없다 — 근사값을 손익처럼
  // 보여주느니 보여주지 않는다. (design.md 미해결 항목)
  const agentState: AgentState = keeper.pending.length > 0
    ? { kind: 'awaiting_approval' }
    : latest
      ? { kind: 'executed' }
      : { kind: 'idle' }

  // 설명은 온체인에 남은 판단 근거에서만 만든다. 화면이 수치를 지어내면
  // Narrator를 격리해 둔 의미가 없어진다 (R8.1).
  //
  // 근거는 실행 '전'에 기록되므로 outcome이 아직 'asked'다. 실제로 실행됐는지는
  // 같은 판단의 Executed 이벤트가 말해주므로 그것으로 보정한다.
  const latestDecided = state.records.filter((r) => r.kind === 'decided').at(-1)
  const narration: Narration | undefined = (() => {
    if (latestDecided?.kind !== 'decided') return undefined
    const executed = state.records.some(
      (r) => r.kind === 'executed' && r.decisionId === latestDecided.decisionId,
    )
    const evidence = executed
      ? { ...latestDecided.evidence, outcome: 'executed' as const }
      : latestDecided.evidence
    return { text: templateNarration(evidence), fallback: true }
  })()

  const effectiveCap = state.autoThreshold === undefined
    ? undefined
    : (state.autoThreshold * BigInt(trust.discretionBps as number)) / 10_000n

  /** 트랜잭션 실패를 삼키지 않고 화면에 알린다 (R6.3). */
  async function send(fn: () => Promise<unknown>, what: string) {
    setTxError(undefined)
    try {
      await fn()
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setTxError(`${what} 실패: ${msg.split('\n')[0]}`)
    }
  }

  async function submitDelegation(d: DelegationDraft) {
    const now = BigInt(Math.floor(Date.now() / 1000))
    await writeContractAsync({
      address: config.vault,
      abi: vaultAbiParsed,
      functionName: 'setDelegation',
      args: [
        {
          executor: config.executor,
          quoteAsset: config.quote,
          maxTradeValue: d.maxTradeValue,
          autoThreshold: d.autoThreshold,
          budget: d.budget,
          expiry: now + BigInt(d.days) * 86_400n,
          allowedAssets: [config.token, config.quote],
          allowedDexes: [config.dex],
        },
      ],
    })
  }

  async function signalDisappointment() {
    await writeContractAsync({
      address: config.vault,
      abi: vaultAbiParsed,
      functionName: 'signalDisappointment',
      args: [],
    })
  }

  async function revokeDelegation() {
    await writeContractAsync({
      address: config.vault,
      abi: vaultAbiParsed,
      functionName: 'revoke',
      args: [],
    })
  }

  return (
    <div className="app">
      <WalletBar config={config} />

      {error && <div className="notice" style={{ marginBottom: 16 }}>{error}</div>}
      {txError && <div className="notice" style={{ marginBottom: 16 }}>{txError}</div>}
      {keeperUrl && !keeper.online && (
        <div className="notice" style={{ marginBottom: 16 }}>
          실행자에 연결되지 않았어요. 자동 실행과 승인 요청은 실행자가 켜져 있어야 보여요.
        </div>
      )}

      <div className="grid">
        <div>
          <CharacterPicker selected={character} onSelect={setCharacter} locked={state.active} />
          {!state.active && (
            <DelegationForm
              tokenSymbol="TOKEN"
              quoteSymbol="USDC"
              tokenAddress={config.token}
              quoteAddress={config.quote}
              onSubmit={(d) => void send(() => submitDelegation(d), '위임 설정')}
              disabled={!guard.canExecute || isPending}
            />
          )}
          {state.active && (
            <DelegationStatus
              budget={state.budget}
              budgetSpent={state.budgetSpent}
              operatingCap={undefined}
              onRevoke={() => void send(revokeDelegation, '위임 철회')}
              canRevoke={guard.canExecute}
              busy={isPending}
            />
          )}
          {state.active && (
            <TrustPanel
              trust={trust}
              autoThreshold={state.autoThreshold}
              onDisappoint={() => void send(signalDisappointment, '실망 표시')}
              canDisappoint={guard.canExecute}
              busy={isPending}
            />
          )}
        </div>

        <div>
          <CharacterStage
            state={agentState}
            characterId={character}
            characterName={view.name}
            narration={narration}
            loader={live2dLoader}
          />
          <ApprovalQueue
            items={keeper.pending}
            capSource={effectiveCap !== undefined && state.autoThreshold !== undefined && effectiveCap < state.autoThreshold ? 'trust' : 'user'}
            effectiveCap={effectiveCap}
            currentBlock={state.blockNumber}
            onApprove={(id) => void keeper.approve(id)}
            onReject={(id) => void keeper.reject(id)}
            busy={keeper.busy}
          />
          <PerformancePanel p={perf} />
          <TrackRecordList records={state.records} />
        </div>
      </div>
    </div>
  )
}
