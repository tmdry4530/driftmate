import { useMemo, useState } from 'react'
import type { CharacterId, Decision, DecisionInput, Narration } from '@soon/shared'
import { CHARACTER_CATALOG_VERSION, bps, characterOf, decide } from '@soon/engine'

import { type AgentState } from './characterState.js'
import { CharacterStage } from './components/CharacterStage.js'
import { live2dLoader } from './live2d.js'
import { templateNarration } from './narrator/narrate.js'
import { CHARACTER_VIEWS, viewOf } from './characters.js'
import {
  CharacterMandateClient,
  connectWallet,
  createProviders,
  deployCharacterMandate,
  toClientError,
  type CharacterMandateProviders,
  type PublicTransaction,
} from './midnight/client.js'
import {
  createPrivateState,
  type CharacterRelationshipPrivateState,
} from './midnight/privateState.js'
import { toProofInput } from './midnight/proofInput.js'

export type DemoPhase =
  | 'disconnected'
  | 'choosing_character'
  | 'opening_relationship'
  | 'ready'
  | 'deciding'
  | 'proving'
  | 'owner_required'
  | 'proved'
  | 'updating_relationship'
  | 'failed'

type Receipt = Readonly<{
  status: 'RELATIONSHIP_OPENED' | 'HELD' | 'PROVED_AUTO_ELIGIBLE' | 'OWNER_REQUIRED' | 'OWNER_APPROVED' | 'OWNER_REJECTED'
  decisionId?: string
  tx: PublicTransaction
}>

const TOKEN = '0x1111111111111111111111111111111111111111' as const
const USDC = '0x2222222222222222222222222222222222222222' as const
const POOL = '0x3333333333333333333333333333333333333333' as const

const PHASE: Record<DemoPhase, { index: number; eyebrow: string; title: string }> = {
  disconnected: { index: 0, eyebrow: '01 / CONNECT', title: 'Lace와 비공개 경계를 엽니다.' },
  choosing_character: { index: 1, eyebrow: '02 / COMMIT', title: '캐릭터와 약속은 이 기기에만 둡니다.' },
  opening_relationship: { index: 1, eyebrow: '02 / COMMIT', title: '관계 commitment를 만들고 있습니다.' },
  ready: { index: 2, eyebrow: '03 / DECIDE', title: '같은 엔진 판단을 proof로 검증합니다.' },
  deciding: { index: 2, eyebrow: '03 / DECIDE', title: '결정론 엔진이 제안을 계산합니다.' },
  proving: { index: 3, eyebrow: '04 / PROVE', title: '로컬에서 영지식 proof를 만들고 있습니다.' },
  owner_required: { index: 4, eyebrow: '05 / OWNER', title: '재량을 넘어 owner의 결정이 필요합니다.' },
  proved: { index: 4, eyebrow: '05 / RECEIPT', title: '규칙 준수 receipt가 Midnight에 확정됐습니다.' },
  updating_relationship: { index: 4, eyebrow: '05 / OWNER', title: 'owner 결정을 기록하고 있습니다.' },
  failed: { index: 0, eyebrow: 'STOPPED / FAIL-CLOSED', title: '비공개 입력을 보내지 않고 중단했습니다.' },
}

const statusLabel: Record<Receipt['status'], string> = {
  RELATIONSHIP_OPENED: '관계 commitment 공개',
  HELD: '판단 검증 · 거래 없음',
  PROVED_AUTO_ELIGIBLE: '재량 내 판단 검증',
  OWNER_REQUIRED: 'owner 결정 필요',
  OWNER_APPROVED: 'owner 승인 기록',
  OWNER_REJECTED: 'owner 거절 기록',
}

const compact = (value: string): string => value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value
const number = new Intl.NumberFormat('ko-KR')

function demoInput(characterId: CharacterId, targetWeightBps: number): DecisionInput {
  return {
    target: {
      weights: [
        { asset: TOKEN, bps: bps(targetWeightBps) },
        { asset: USDC, bps: bps(10_000 - targetWeightBps) },
      ],
    },
    strategy: characterOf(characterId),
    holdings: [
      { asset: TOKEN, amount: 3_000_000_000_000_000_000n, decimals: 18 },
      { asset: USDC, amount: 4_000_000_000n, decimals: 6 },
    ],
    price: {
      blockNumber: 100n,
      pool: POOL,
      quoteAsset: USDC,
      prices: [
        { asset: TOKEN, priceE18: 2_400_000_000n },
        { asset: USDC, priceE18: 1_000_000_000_000_000_000n },
      ],
      maxAgeBlocks: 10n,
    },
    costEstimate: { gasValue: 1_000_000n, slippageValue: 1_000_000n, operatingValue: 500_000n },
    currentBlock: 105n,
    slippageToleranceBps: bps(50),
  }
}

const safeMessage = (error: unknown): string => {
  if (error instanceof Error && /Lace|network|proof server|계약 주소/.test(error.message)) return error.message
  return toClientError(error).message
}

export function MidnightApp() {
  const networkId = import.meta.env.VITE_MIDNIGHT_NETWORK_ID ?? 'undeployed'
  const [phase, setPhase] = useState<DemoPhase>('disconnected')
  const [retryPhase, setRetryPhase] = useState<DemoPhase>('disconnected')
  const [characterId, setCharacterId] = useState<CharacterId>('timid')
  const [targetWeight, setTargetWeight] = useState('6000')
  const [autoThreshold, setAutoThreshold] = useState('1000000000')
  const [budget, setBudget] = useState('10000000000')
  const [days, setDays] = useState('7')
  const [providers, setProviders] = useState<CharacterMandateProviders>()
  const [client, setClient] = useState<CharacterMandateClient>()
  const [relationship, setRelationship] = useState<CharacterRelationshipPrivateState>()
  const [decision, setDecision] = useState<Decision>()
  const [proofDecisionId, setProofDecisionId] = useState<Uint8Array>()
  const [receipt, setReceipt] = useState<Receipt>()
  const [error, setError] = useState<string>()
  const [reveal, setReveal] = useState(false)
  const [history, setHistory] = useState<readonly string[]>([])
  const view = viewOf(characterId)
  const busy = ['opening_relationship', 'deciding', 'proving', 'updating_relationship'].includes(phase)
  const current = PHASE[phase]

  const agentState: AgentState =
    phase === 'owner_required'
      ? { kind: 'awaiting_approval' }
      : phase === 'deciding' || phase === 'proving' || phase === 'opening_relationship' || phase === 'updating_relationship'
        ? { kind: 'deciding' }
        : { kind: 'idle' }

  const narration = useMemo<Narration | undefined>(() => {
    if (!decision) return undefined
    if (receipt?.status === 'HELD') return { text: templateNarration(decision.evidence), fallback: false }
    if (receipt) return {
      text: receipt.status === 'OWNER_REQUIRED'
        ? '제 재량을 넘었어요. 정확한 한도는 공개하지 않고 owner에게만 결정을 부탁할게요.'
        : '내 성향과 비공개 약속을 지킨 판단이라는 proof가 확정됐어요. 거래 실행 증거는 별도예요.',
      fallback: false,
    }
    return undefined
  }, [decision, receipt])

  const fail = (cause: unknown, retry: DemoPhase) => {
    setRetryPhase(retry)
    setError(safeMessage(cause))
    setPhase('failed')
  }

  async function connect() {
    setError(undefined)
    try {
      const wallet = await connectWallet(networkId)
      const nextProviders = await createProviders(
        wallet,
        networkId,
        new URL(import.meta.env.BASE_URL ?? '/', window.location.origin).toString(),
        window.fetch.bind(window),
      )
      setProviders(nextProviders)
      setHistory(['Lace network와 로컬 prover 경계를 확인했습니다.'])
      setPhase('choosing_character')
    } catch (cause) {
      fail(cause, 'disconnected')
    }
  }

  async function openRelationship() {
    if (!providers) return fail(new Error('Lace 연결이 필요합니다.'), 'disconnected')
    setError(undefined)
    setPhase('opening_relationship')
    try {
      const state = createPrivateState({
        characterId,
        targetWeightBps: Number(targetWeight),
        autoThreshold: BigInt(autoThreshold),
        budget: BigInt(budget),
        expiry: BigInt(Math.floor(Date.now() / 1000)) + BigInt(days) * 86_400n,
      })
      const nextClient = await deployCharacterMandate(providers, state)
      const tx = await nextClient.open(state)
      setRelationship(state)
      setClient(nextClient)
      setReceipt({ status: 'RELATIONSHIP_OPENED', tx })
      setHistory((items) => [...items, '비공개 원문 대신 관계 commitment만 확정했습니다.'])
      setPhase('ready')
    } catch (cause) {
      fail(cause, 'choosing_character')
    }
  }

  async function proveDecision() {
    if (!client || !relationship) return fail(new Error('비공개 관계 상태가 없습니다.'), 'choosing_character')
    setError(undefined)
    setPhase('deciding')
    try {
      const decisionInput = demoInput(relationship.characterId, relationship.targetWeightBps)
      const nextDecision = decide(decisionInput)
      setDecision(nextDecision)
      const input = toProofInput(nextDecision, relationship, {
        decisionInput,
        currentTimestamp: BigInt(Math.floor(Date.now() / 1000)),
        catalogVersion: CHARACTER_CATALOG_VERSION,
      })
      setProofDecisionId(input.decisionId)
      setPhase('proving')
      const tx = await client.prove(input)
      const effectiveCap = (relationship.autoThreshold * BigInt(1_000 + relationship.trustScore * 90)) / 10_000n
      const status: Receipt['status'] = nextDecision.kind !== 'rebalance'
        ? 'HELD'
        : nextDecision.totalValue <= effectiveCap
          ? 'PROVED_AUTO_ELIGIBLE'
          : 'OWNER_REQUIRED'
      setReceipt({ status, decisionId: nextDecision.id, tx })
      setHistory((items) => [...items, status === 'OWNER_REQUIRED' ? '규칙 검증 후 owner 결정을 요청했습니다.' : '캐릭터 규칙 준수 proof가 확정됐습니다.'])
      setPhase(status === 'OWNER_REQUIRED' ? 'owner_required' : 'proved')
    } catch (cause) {
      fail(cause, 'ready')
    }
  }

  async function resolve(approved: boolean) {
    if (!client || !proofDecisionId || !receipt?.decisionId) return
    setError(undefined)
    setPhase('updating_relationship')
    try {
      const tx = await client.resolve(proofDecisionId, approved)
      const status = approved ? 'OWNER_APPROVED' : 'OWNER_REJECTED'
      setReceipt({ status, decisionId: receipt.decisionId, tx })
      setHistory((items) => [...items, approved ? 'owner가 제안을 승인했습니다.' : 'owner가 제안을 거절했습니다.'])
      setPhase('proved')
    } catch (cause) {
      fail(cause, 'owner_required')
    }
  }

  return (
    <main className="midnight-shell">
      <header className="midnight-rail">
        <a className="wordmark" href="#top" aria-label="DriftMate 홈">
          <span className="wordmark-mark" aria-hidden="true">DM</span>
          <span>DRIFTMATE <small>/ PRIVATE CHARACTER PROTOCOL</small></span>
        </a>
        <div className="network-status" aria-label={`Midnight network ${networkId}`}>
          <span className={providers ? 'status-dot online' : 'status-dot'} aria-hidden="true" />
          <span>{networkId}</span>
          <strong>{providers ? 'LACE CONNECTED' : 'OFFLINE'}</strong>
        </div>
      </header>

      <section id="top" className="midnight-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="section-code">{current.eyebrow}</p>
          <h1 id="hero-title">AI 캐릭터와의 약속은 숨기고,<br />지켰다는 사실만 증명합니다.</h1>
          <p className="hero-lede">
            평범한 리밸런서가 아닙니다. 캐릭터의 고정 성향과 쌓인 신뢰가 재량을 만들고,
            Midnight가 그 관계 규칙을 원문 공개 없이 검증합니다.
          </p>
          <ol className="phase-track" aria-label="데모 진행 단계">
            {['LACE', 'RELATIONSHIP', 'DECISION', 'PROOF', 'RECEIPT'].map((label, index) => (
              <li key={label} className={index < current.index ? 'done' : index === current.index ? 'active' : ''}>
                <span>{String(index + 1).padStart(2, '0')}</span>{label}
              </li>
            ))}
          </ol>
        </div>

        <div className="character-console">
          <div className="fact-line" aria-live="polite">
            <span>현재 사실</span>
            <strong>{current.title}</strong>
          </div>
          <CharacterStage
            state={agentState}
            characterId={characterId}
            characterName={view.name}
            narration={narration}
            loader={live2dLoader}
          />

          {phase === 'disconnected' && (
            <button className="midnight-primary" type="button" onClick={() => void connect()}>
              Lace 연결하고 시작
              <span aria-hidden="true">↗</span>
            </button>
          )}

          {(phase === 'choosing_character' || phase === 'opening_relationship') && (
            <div className="mandate-form">
              <fieldset disabled={busy}>
                <legend>누구와 관계를 맺을까요?</legend>
                <div className="character-choices">
                  {CHARACTER_VIEWS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={characterId === item.id}
                      onClick={() => setCharacterId(item.id)}
                    >
                      <span>{item.name}</span>
                      <small>{item.personality}</small>
                      <em>{item.bandLabel}</em>
                    </button>
                  ))}
                </div>
                <div className="mandate-fields">
                  <label>첫 자산 목표 비중 <input type="number" min="1001" max="8999" step="100" value={targetWeight} onChange={(event) => setTargetWeight(event.target.value)} /></label>
                  <label>자동 재량 한도 <input type="number" min="1" value={autoThreshold} onChange={(event) => setAutoThreshold(event.target.value)} /></label>
                  <label>누적 예산 <input type="number" min="1" value={budget} onChange={(event) => setBudget(event.target.value)} /></label>
                  <label>관계 기간 <input type="number" min="1" max="365" value={days} onChange={(event) => setDays(event.target.value)} /></label>
                </div>
              </fieldset>
              <button className="midnight-primary" type="button" disabled={busy} onClick={() => void openRelationship()}>
                {busy ? 'commitment 생성 중…' : '비공개 관계 열기'} <span aria-hidden="true">→</span>
              </button>
            </div>
          )}

          {phase === 'ready' && (
            <button className="midnight-primary" type="button" onClick={() => void proveDecision()}>
              캐릭터 판단 증명하기 <span aria-hidden="true">→</span>
            </button>
          )}

          {busy && <div className="proof-progress" role="status"><span aria-hidden="true" />{current.title}</div>}

          {phase === 'owner_required' && (
            <div className="owner-actions" aria-label="owner 결정">
              <p>정확한 금액과 한도는 이 기기에서만 비교했습니다.</p>
              <button type="button" onClick={() => void resolve(false)}>거절</button>
              <button className="midnight-primary" type="button" onClick={() => void resolve(true)}>승인하고 기록</button>
            </div>
          )}

          {phase === 'failed' && (
            <div className="fail-panel" role="alert">
              <strong>FAIL-CLOSED</strong>
              <p>{error}</p>
              <button type="button" onClick={() => { setError(undefined); setPhase(retryPhase) }}>안전한 단계에서 다시 시도</button>
            </div>
          )}
        </div>
      </section>

      <section className="boundary-section" aria-labelledby="boundary-title">
        <div className="section-heading">
          <p className="section-code">PRIVACY BOUNDARY / ONE VIEWPORT</p>
          <h2 id="boundary-title">캐릭터는 보이지만, 관계의 원문은 공개되지 않습니다.</h2>
        </div>
        <div className="boundary-grid">
          <article className="private-panel">
            <div className="panel-label"><span aria-hidden="true">●</span> PRIVATE · 이 기기에서만 보임</div>
            <h3>{relationship ? `${view.name}와 맺은 관계` : '아직 관계를 만들지 않았습니다.'}</h3>
            <dl>
              <div><dt>캐릭터 성향</dt><dd>{relationship ? view.personality : '—'}</dd></div>
              <div><dt>현재 신뢰</dt><dd>{relationship ? `${relationship.trustScore} / 100` : '—'}</dd></div>
              <div><dt>재량 원문</dt><dd>{relationship && reveal ? number.format(relationship.autoThreshold) : relationship ? '••••••••' : '—'}</dd></div>
              <div><dt>누적 예산 원문</dt><dd>{relationship && reveal ? number.format(relationship.budget) : relationship ? '••••••••' : '—'}</dd></div>
            </dl>
            <button className="text-button" type="button" disabled={!relationship} aria-pressed={reveal} onClick={() => setReveal((value) => !value)}>
              {reveal ? '로컬 원문 가리기' : '이 기기에서만 원문 보기'}
            </button>
            <p className="privacy-note">새로고침하면 이 상태는 복원되지 않습니다. localStorage·URL·서버로 보내지 않습니다.</p>
          </article>

          <article className="proof-panel">
            <div className="panel-label"><span aria-hidden="true">◇</span> PROVEN · circuit이 검증</div>
            <h3>{decision ? `${(Number(decision.evidence.driftBps) / 100).toFixed(2)}% 이탈 판단` : '판단 proof를 기다립니다.'}</h3>
            <ul>
              <li><span>등록 캐릭터 전략</span><strong>{decision ? 'MATCH' : 'WAIT'}</strong></li>
              <li><span>만료·예산·비용</span><strong>{receipt?.decisionId ? 'VALID' : 'WAIT'}</strong></li>
              <li><span>신뢰 기반 재량</span><strong>{receipt?.decisionId ? 'VERIFIED' : 'WAIT'}</strong></li>
              <li><span>decision replay</span><strong>{receipt?.decisionId ? 'BLOCKED' : 'WAIT'}</strong></li>
            </ul>
          </article>

          <article className="public-panel">
            <div className="panel-label"><span aria-hidden="true">◎</span> PUBLIC · Midnight ledger</div>
            <h3>{receipt ? statusLabel[receipt.status] : '공개 receipt가 없습니다.'}</h3>
            <dl>
              <div><dt>decision ID</dt><dd>{receipt?.decisionId ? compact(receipt.decisionId) : '—'}</dd></div>
              <div><dt>versions</dt><dd>{receipt ? 'catalog 1 · trust 1 · circuit 1' : '—'}</dd></div>
              <div><dt>tx ID</dt><dd title={receipt?.tx.txId}>{receipt ? compact(receipt.tx.txId) : '—'}</dd></div>
              <div><dt>block</dt><dd>{receipt ? number.format(receipt.tx.blockHeight) : '—'}</dd></div>
            </dl>
            <p className="receipt-warning">이 receipt는 캐릭터 규칙 준수를 증명합니다. 자산 수탁·수익·EVM swap 실행을 증명하지 않습니다.</p>
          </article>
        </div>
      </section>

      <section className="relationship-log" aria-labelledby="log-title">
        <div>
          <p className="section-code">RELATIONSHIP, NOT A BOT SKIN</p>
          <h2 id="log-title">신뢰가 바꾸는 것은 거래가 아니라 재량입니다.</h2>
        </div>
        <ol>
          {(history.length > 0 ? history : ['Lace 연결 후 검증 가능한 관계 이력이 시작됩니다.']).map((item, index) => (
            <li key={`${index}-${item}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></li>
          ))}
        </ol>
      </section>

      <footer className="midnight-footer">
        <span>DRIFTMATE × MIDNIGHT</span>
        <p>Private character policy proof layer · EVM AgentVault remains the final execution boundary.</p>
      </footer>
    </main>
  )
}
