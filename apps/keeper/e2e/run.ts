/**
 * 최소 루프 E2E (T21).
 *
 * 실제 EVM 노드 위에서 예치 → 위임 → 가격 이동 → 판단 → 실행 → 기록 → 신뢰 반영까지
 * 한 번에 돌린다. 여기까지 통과해야 "동작한다"고 말할 수 있다.
 *
 * 실행: pnpm e2e
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Server } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseAbi,
  toHex,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { canonical, characterOf, computeTrust } from '@soon/engine'
import { CostMeter } from '../src/payment.js'
import { VaultBudgetAdapter } from '../src/vaultBudgetAdapter.js'
import { Keeper } from '../src/keeper.js'
import { ViemChainReader, ViemVaultWriter } from '../src/viemAdapters.js'
import { loadTrackRecords } from '../src/records.js'
import { strategyHash, SUPPORTED_TRUST_FORMULA_VERSION } from '../src/delegation.js'
import { startApi } from '../src/server.js'
import { erc20Abi, vaultAbi } from '../src/abi.js'

const KEEP = process.env.KEEP === '1'

function port(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isInteger(value) || value < 0 || value > 65_535) throw new Error(`${name} 포트가 잘못됐다`)
  return value
}

const PORT = port('E2E_RPC_PORT', 8546)
const REQUESTED_API_PORT = port('E2E_KEEPER_PORT', KEEP ? 8945 : 0)
const RPC = `http://127.0.0.1:${PORT}`
const ANVIL_BIN = process.env.ANVIL_BIN ?? 'anvil'
const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../../../packages/contracts/out')

// Anvil 기본 계정
const OWNER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const EXECUTOR_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'

const chain = defineChain({
  id: 31337,
  name: 'Anvil E2E',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
})

type Artifact = { abi: readonly unknown[]; bytecode: { object: `0x${string}` } }

function artifact(name: string, source = `${name}.sol`): Artifact {
  return JSON.parse(readFileSync(`${OUT}/${source}/${name}.json`, 'utf8')) as Artifact
}

const checks: { label: string; ok: boolean; detail?: string }[] = []

function check(label: string, ok: boolean, detail?: string) {
  checks.push({ label, ok, ...(detail === undefined ? {} : { detail }) })
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`)
}

async function startAnvil(): Promise<ChildProcess> {
  const proc = spawn(ANVIL_BIN, ['--port', String(PORT), '--silent'], {
    stdio: 'ignore',
  })
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber' }),
      })
      if (res.ok) return proc
    } catch {
      /* 아직 안 떴다 */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('anvil이 뜨지 않았다')
}

async function deploy(
  wallet: WalletClient,
  pub: PublicClient,
  name: string,
  args: readonly unknown[],
  source?: string,
): Promise<Address> {
  const a = artifact(name, source)
  const account = wallet.account!
  const hash = await wallet.deployContract({
    abi: a.abi as never,
    bytecode: a.bytecode.object,
    args: args as never,
    account,
    chain,
  })
  const receipt = await pub.waitForTransactionReceipt({ hash })
  if (!receipt.contractAddress) throw new Error(`${name} 배포 실패`)
  return receipt.contractAddress
}

async function main() {
  console.log('\n▶ Anvil 시작')
  const anvil = await startAnvil()
  let keepRunning = false
  let api: Server | undefined

  try {
    const pub = createPublicClient({ chain, transport: http(RPC) }) as PublicClient
    const owner = privateKeyToAccount(OWNER_KEY)
    const executor = privateKeyToAccount(EXECUTOR_KEY)
    const ownerWallet = createWalletClient({ account: owner, chain, transport: http(RPC) })
    const executorWallet = createWalletClient({ account: executor, chain, transport: http(RPC) })

    const ERC20 = parseAbi(erc20Abi)
    const VAULT = parseAbi(vaultAbi)
    const DEX = parseAbi([
      'function addLiquidity(uint256 amount0, uint256 amount1)',
      'function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut, address to) returns (uint256)',
      'function getSpotPriceE18(address tokenIn) view returns (uint256)',
      'function getAmountOut(address tokenIn, uint256 amountIn) view returns (uint256)',
    ])

    // --- 배포 -------------------------------------------------------------
    console.log('\n▶ 배포')
    const token = await deploy(ownerWallet, pub, 'MockERC3009', ['Token A', 'TKA', 18])
    const usdc = await deploy(ownerWallet, pub, 'MockERC3009', ['Mock USD', 'mUSD', 6])
    const dex = await deploy(ownerWallet, pub, 'MockDex', [token, usdc])
    const vault = await deploy(ownerWallet, pub, 'AgentVault', [owner.address])
    console.log(`  TOKEN ${token}\n  USDC  ${usdc}\n  DEX   ${dex}\n  VAULT ${vault}`)

    const send = async (address: Address, abi: readonly unknown[], fn: string, args: readonly unknown[]) => {
      const hash = await ownerWallet.writeContract({
        address, abi: abi as never, functionName: fn as never, args: args as never, account: owner, chain,
      })
      const receipt = await pub.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error(`${fn} 트랜잭션이 실패했다`)
    }

    // 깊은 풀: TOKEN 1개 = 2000 USDC
    await send(token, ERC20, 'mint', [owner.address, 100_000n * 10n ** 18n])
    await send(usdc, ERC20, 'mint', [owner.address, 200_000_000n * 10n ** 6n])
    await send(token, ERC20, 'approve', [dex, 2n ** 255n])
    await send(usdc, ERC20, 'approve', [dex, 2n ** 255n])
    await send(dex, DEX, 'addLiquidity', [100_000n * 10n ** 18n, 200_000_000n * 10n ** 6n])

    // --- 1. 예치와 위임 ----------------------------------------------------
    console.log('\n▶ 1. 예치와 위임 서명')
    await send(token, ERC20, 'mint', [owner.address, 3n * 10n ** 18n])
    await send(usdc, ERC20, 'mint', [owner.address, 4_000n * 10n ** 6n])
    await send(token, ERC20, 'approve', [vault, 2n ** 255n])
    await send(usdc, ERC20, 'approve', [vault, 2n ** 255n])
    await send(vault, VAULT, 'deposit', [token, 3n * 10n ** 18n]) // $6000
    await send(vault, VAULT, 'deposit', [usdc, 4_000n * 10n ** 6n]) // $4000

    const now = BigInt(Math.floor(Date.now() / 1000))
    const delegationConfig = {
      executor: executor.address,
      characterId: '0x74696d6964000000000000000000000000000000000000000000000000000000',
      strategyHash: strategyHash(characterOf('timid')),
      trustFormulaVersion: SUPPORTED_TRUST_FORMULA_VERSION,
      quoteAsset: usdc,
      maxTradeValue: 3_000n * 10n ** 6n,
      autoThreshold: 2_000n * 10n ** 6n,
      budget: 5_000n * 10n ** 6n,
      operatingCap: 50n * 10n ** 6n,
      expiry: now + 30n * 24n * 3600n,
      approvalTtlSeconds: 3_600n,
      slippageToleranceBps: 100,
      targetAsset: token,
      targetAssetBps: 6_000,
      allowedAssets: [token, usdc],
      allowedDexes: [dex],
    } as const
    await send(vault, VAULT, 'setDelegation', [delegationConfig])
    check('예치와 위임이 온체인에 기록됨', await pub.readContract({ address: vault, abi: VAULT, functionName: 'isActive' }))

    // --- Keeper 구성 -------------------------------------------------------
    const reader = new ViemChainReader(pub)
    const writer = new ViemVaultWriter(executorWallet, pub)
    const adapter = new VaultBudgetAdapter({
      price_data: 500_000n, // $0.5
      narration: 200_000n,
    })
    const readRecords = (toBlock?: bigint) => loadTrackRecords(pub, vault, 0n, toBlock)
    const meter = new CostMeter(adapter)
    let llmCalls = 0
    const keeper = new Keeper(reader, writer, meter, {
      vault,
      maxAgeBlocks: 20n,
      gasValueEstimate: 100_000n,
    }, readRecords, {
      complete: async () => {
        llmCalls += 1
        return 'I am reviewing the verified facts carefully.'
      },
    })
    api = startApi(keeper, REQUESTED_API_PORT)
    await once(api, 'listening')
    const apiAddress = api.address()
    if (!apiAddress || typeof apiAddress === 'string') throw new Error('Keeper API 주소를 읽지 못했다')
    const apiBase = `http://127.0.0.1:${apiAddress.port}`
    const evidence = {
      weights: [
        { asset: token, currentBps: 6_500, targetBps: 6_000 },
        { asset: usdc, currentBps: 3_500, targetBps: 4_000 },
      ],
      driftBps: 500,
      bandBps: 300,
      outcome: 'asked',
    } as const
    const evidenceHex = toHex(canonical(evidence))
    const proposePending = async (label: string) => {
      const stateNonce = await pub.readContract({ address: vault, abi: VAULT, functionName: 'stateNonce' })
      const amountIn = 10n ** 16n
      const quoted = await pub.readContract({
        address: dex,
        abi: DEX,
        functionName: 'getAmountOut',
        args: [token, amountIn],
      })
      const decisionId = keccak256(toHex(label))
      const trade = {
        tokenIn: token,
        tokenOut: usdc,
        amountIn,
        minAmountOut: (quoted * 9_900n) / 10_000n,
      }
      await writer.propose({
        vault,
        delegationId: 1n,
        stateNonce,
        decisionId,
        evidence: evidenceHex,
        priceCost: 0n,
        dex,
        trade,
      })
      return { decisionId, trade, stateNonce: stateNonce + 1n }
    }

    // --- 2. 밴드 안에서는 거래하지 않는다 -----------------------------------
    console.log('\n▶ 2. 균형 상태에서 tick')
    const idle = await keeper.tick()
    check(
      '밴드 안이라 거래를 만들지 않음',
      idle.kind === 'skipped',
      idle.kind === 'inactive' ? `${idle.kind}:${idle.reason}` : idle.kind,
    )
    check('무거래 판단도 온체인에 남음', (await readRecords()).some((r) => r.kind === 'not_executed'))
    check('Narrator가 판단마다 한 번만 호출됨', llmCalls === 1)
    check('검증된 Narrator 결과가 표시 상태에 연결됨', keeper.status().narration?.fallback === false)
    const restarted = new Keeper(
      reader,
      writer,
      new CostMeter(adapter),
      { vault, maxAgeBlocks: 20n, gasValueEstimate: 100_000n },
      readRecords,
    )
    check('재시작은 재과금 없이 템플릿으로 복구함', (await restarted.refreshStatus()).narration?.fallback === true)

    // --- 3. 가격을 움직인다 -------------------------------------------------
    console.log('\n▶ 3. 가격 상승 유도')
    await send(usdc, ERC20, 'mint', [owner.address, 30_000_000n * 10n ** 6n])
    await send(dex, DEX, 'swap', [usdc, 30_000_000n * 10n ** 6n, 0n, owner.address])
    const spot = await pub.readContract({ address: dex, abi: DEX, functionName: 'getSpotPriceE18', args: [token] })
    check('TOKEN 가격이 올랐다', spot > 2_000_000_000n, `spotE18=${spot}`)

    // --- 4. 자동 실행 -------------------------------------------------------
    console.log('\n▶ 4. 이탈 발생 후 tick')
    const acted = await keeper.tick()
    check('자동 실행됨', acted.kind === 'executed', acted.kind)

    const afterExec = await readRecords()
    const executed = afterExec.find((r) => r.kind === 'executed')
    check('실행이 온체인에 기록됨', executed !== undefined)
    check('비용이 같은 판단에 귀속됨',
      afterExec.some((r) => r.kind === 'cost' && acted.kind === 'executed' && r.decisionId === acted.decisionId))

    // --- 5. 순성과와 신뢰 ---------------------------------------------------
    console.log('\n▶ 5. 순성과와 신뢰')
    if (executed?.kind === 'executed') {
      const cost = afterExec
        .filter((r) => r.kind === 'cost' && r.decisionId === executed.decisionId)
        .reduce((a, r) => a + (r.kind === 'cost' ? r.amount : 0n), 0n)
      const frictionBps = Number(((executed.frictionQuote + cost) * 10_000n) / executed.valueInQuote)
      check('마찰비용이 계산됨', executed.valueInQuote > 0n, `규모=${executed.valueInQuote} 마찰=${frictionBps}bp`)
      // 슬리피지가 0이면 주소 비교가 어긋나 quote 자산을 못 알아본 것이다.
      // 운영비만 잡혀도 "마찰이 계산됨"은 통과하므로 따로 확인한다.
      check('슬리피지가 잡힘', executed.frictionQuote > 0n, `슬리피지=${executed.frictionQuote}`)
      check('운영비가 마찰에 포함됨', cost > 0n, `운영비=${cost}`)

      // 실행된 바로 그 판단의 근거를 찾는다. 첫 판단은 균형 상태라 이탈이 0이다.
      const decided = afterExec.find(
        (r) => r.kind === 'decided' && r.decisionId === executed.decisionId,
      )
      check('판단 근거가 온체인에서 복원됨', decided !== undefined)
      if (decided?.kind === 'decided' && decided.evidence) {
        check(
          '근거에 실제 이탈폭이 담김',
          (decided.evidence.driftBps as number) > 0,
          `drift=${decided.evidence.driftBps}bp`,
        )
        check('근거에 자산별 비중이 담김', decided.evidence.weights.length === 2)
      }
    }
    const trust = computeTrust(afterExec, 'timid', 1)
    check('신뢰가 기록에서 재현됨', trust.contributions.length > 0, `score=${trust.score}`)
    check('신뢰가 사용자 상한을 넘지 않음', (trust.discretionBps as number) <= 10_000)

    console.log('\n▶ 5-1. 반대 방향 자동 실행')
    await send(token, ERC20, 'mint', [owner.address, 10_000n * 10n ** 18n])
    await send(dex, DEX, 'swap', [token, 10_000n * 10n ** 18n, 0n, owner.address])
    const reverse = await keeper.tick()
    const reverseRecord = (await readRecords()).find(
      (record) =>
        record.kind === 'executed' &&
        reverse.kind === 'executed' &&
        record.decisionId === reverse.decisionId,
    )
    check(
      'quote→TOKEN 방향도 자동 실행됨',
      reverseRecord?.kind === 'executed' && reverseRecord.tokenIn.toLowerCase() === usdc.toLowerCase(),
      reverse.kind === 'skipped' ? `${reverse.kind}:${reverse.reason}` : reverse.kind,
    )

    // --- 6. 승인 요청 경로 --------------------------------------------------
    console.log('\n▶ 6. 신뢰를 떨어뜨려 승인 요청 경로 확인')
    for (let i = 0; i < 4; i++) {
      await send(vault, VAULT, 'signalDisappointment', [1n, `0x${(i + 1).toString(16).padStart(64, '0')}`])
    }
    const lowTrust = computeTrust(await readRecords(), 'timid', 1)
    check('실망 표시로 신뢰가 내려감', lowTrust.score < trust.score, `${trust.score} → ${lowTrust.score}`)
    check('재량도 함께 좁아짐', (lowTrust.discretionBps as number) < (trust.discretionBps as number))

    await send(usdc, ERC20, 'mint', [owner.address, 40_000_000n * 10n ** 6n])
    await send(dex, DEX, 'swap', [usdc, 40_000_000n * 10n ** 6n, 0n, owner.address])
    const asked = await keeper.tick()
    check('임계값을 넘어 승인을 요청함', asked.kind === 'asked', asked.kind)

    if (asked.kind === 'asked') {
      const response = await fetch(`${apiBase}/status`)
      const body = await response.json() as {
        phase: string
        pending?: {
          delegationId: string
          stateNonce: string
          decisionId: `0x${string}`
          dex: Address
          trade: { tokenIn: Address; tokenOut: Address; amountIn: string; minAmountOut: string }
        }
      }
      check('GET /status가 pending bigint를 문자열로 반환함',
        response.ok && body.phase === 'awaiting_approval' && typeof body.pending?.trade.amountIn === 'string')
      check('HTTP 승인 경로가 없음',
        (await fetch(`${apiBase}/approve`, { method: 'POST' })).status === 404)
      const request = body.pending
      if (!request) throw new Error('pending order missing')
      if (!KEEP) {
        await send(vault, VAULT, 'executeApproved', [
          BigInt(request.delegationId),
          BigInt(request.stateNonce),
          request.decisionId,
          {
            dex: request.dex,
            tokenIn: request.trade.tokenIn,
            tokenOut: request.trade.tokenOut,
            amountIn: BigInt(request.trade.amountIn),
            minAmountOut: BigInt(request.trade.minAmountOut),
          },
        ])
        check('owner 지갑 승인으로 실행됨', true)
      }
    }

    if (!KEEP && asked.kind === 'asked') {
      console.log('\n▶ 7. 거절·만료·실패 종결')
      const rejected = await proposePending('owner-reject')
      await send(vault, VAULT, 'reject', [1n, rejected.stateNonce, rejected.decisionId])
      check(
        'owner 거절이 미실행 기록으로 남음',
        (await readRecords()).some(
          (record) =>
            record.kind === 'not_executed' &&
            record.decisionId === rejected.decisionId &&
            record.reason === 'rejected',
        ),
      )

      const expired = await proposePending('approval-expired')
      await pub.request({ method: 'evm_increaseTime', params: [3_601] } as never)
      await pub.request({ method: 'evm_mine', params: [] } as never)
      await writer.expire({
        vault,
        delegationId: 1n,
        stateNonce: expired.stateNonce,
        decisionId: expired.decisionId,
      })
      check(
        '만료 요청이 실행 없이 기록됨',
        (await readRecords()).some(
          (record) =>
            record.kind === 'not_executed' &&
            record.decisionId === expired.decisionId &&
            record.reason === 'expired',
        ),
      )

      const failed = await proposePending('approved-swap-failure')
      await send(token, ERC20, 'mint', [owner.address, 20_000n * 10n ** 18n])
      await send(dex, DEX, 'swap', [token, 20_000n * 10n ** 18n, 0n, owner.address])
      let approvalFailed = false
      try {
        await send(vault, VAULT, 'executeApproved', [
          1n,
          failed.stateNonce,
          failed.decisionId,
          { dex, ...failed.trade },
        ])
      } catch {
        approvalFailed = true
      }
      const pendingAfterFailure = await pub.readContract({
        address: vault,
        abi: VAULT,
        functionName: 'pendingDecision',
      })
      check('승인 실행 실패가 포트폴리오를 바꾸지 않고 pending을 보존함',
        approvalFailed && pendingAfterFailure.open)
      await send(vault, VAULT, 'finalizePendingFailure', [
        1n,
        failed.stateNonce,
        failed.decisionId,
        8,
      ])
      check(
        'owner가 기존 판단을 실패로 한 번 종결함',
        (await readRecords()).some(
          (record) =>
            record.kind === 'not_executed' &&
            record.decisionId === failed.decisionId &&
            record.reason === 'execution_failed',
        ),
      )

      console.log('\n▶ 8. 손실·실망·직접 전송 차단')
      await send(token, ERC20, 'mint', [owner.address, 50_000n * 10n ** 18n])
      await send(dex, DEX, 'swap', [token, 50_000n * 10n ** 18n, 0n, owner.address])
      const lossStatus = await keeper.refreshStatus()
      check('동일 가격 원천의 세션 손실 보고가 생성됨', lossStatus.lossReport?.status === 'loss')
      if (lossStatus.lossReport?.status === 'loss') {
        await send(vault, VAULT, 'signalDisappointment', [1n, lossStatus.lossReport.reportId])
        check(
          '검증된 reportId의 실망이 기록됨',
          (await readRecords()).some(
            (record) =>
              record.kind === 'disappointed' &&
              record.reportId === lossStatus.lossReport?.reportId,
          ),
        )
      }

      await send(token, ERC20, 'mint', [vault, 1n])
      const cashflow = await keeper.tick()
      check(
        '직접 dust 전송은 cashflow_unknown으로 판단과 실행을 중단함',
        cashflow.kind === 'inactive' && cashflow.reason === 'cashflow_unknown',
      )

      console.log('\n▶ 9. 가격 장애 중 owner 인출')
      const currentPrice = await pub.readContract({
        address: dex,
        abi: DEX,
        functionName: 'getSpotPriceE18',
        args: [token],
      })
      const brokenDex = await deploy(
        ownerWallet,
        pub,
        'TogglePriceDex',
        [token, usdc, currentPrice],
        'AgentVaultDelegation.t.sol',
      )
      const currentTime = (await pub.getBlock()).timestamp
      await send(vault, VAULT, 'setDelegation', [{
        ...delegationConfig,
        expiry: currentTime + 30n * 24n * 3_600n,
        allowedDexes: [brokenDex],
      }])
      const BROKEN_DEX = parseAbi(['function setBroken(bool value)'])
      await send(brokenDex, BROKEN_DEX, 'setBroken', [true])
      const beforeWithdraw = await pub.readContract({
        address: token,
        abi: ERC20,
        functionName: 'balanceOf',
        args: [owner.address],
      })
      await send(vault, VAULT, 'withdraw', [token, 1n])
      const afterWithdraw = await pub.readContract({
        address: token,
        abi: ERC20,
        functionName: 'balanceOf',
        args: [owner.address],
      })
      check('가격 장애와 무관하게 owner에게만 인출됨', afterWithdraw === beforeWithdraw + 1n)
      check('인출이 활성 위임을 종료함',
        !(await pub.readContract({ address: vault, abi: VAULT, functionName: 'isActive' })))
    }

    // --- 환경 유지 (선택) ----------------------------------------------------
    if (KEEP) {
      const envPath = resolve(HERE, '../../web/.env')
      writeFileSync(
        envPath,
        [
          `VITE_CHAIN_ID=31337`,
          `VITE_CHAIN_NAME=Anvil E2E`,
          `VITE_RPC_URL=${RPC}`,
          `VITE_VAULT_ADDRESS=${vault}`,
          `VITE_DEX_ADDRESS=${dex}`,
          `VITE_TOKEN_ADDRESS=${token}`,
          `VITE_QUOTE_ADDRESS=${usdc}`,
          `VITE_EXECUTOR_ADDRESS=${executor.address}`,
          `VITE_KEEPER_URL=${apiBase}`,
          '',
        ].join('\n'),
      )
      keepRunning = true
      console.log(`\n▶ 환경 유지 중`)
      console.log(`  RPC        ${RPC}`)
      console.log(`  Keeper API ${apiBase}`)
      console.log(`  .env       ${envPath} (갱신됨 — vite 재시작 필요)`)
    }

    // --- 결과 --------------------------------------------------------------
    const failed = checks.filter((c) => !c.ok)
    console.log(`\n${'─'.repeat(50)}`)
    console.log(`${checks.length - failed.length}/${checks.length} 통과`)
    if (failed.length > 0) {
      console.log('\n실패:')
      for (const f of failed) console.log(`  ✗ ${f.label}`)
      process.exitCode = 1
    } else {
      console.log('최소 루프 완주 ✓')
    }
  } finally {
    if (!keepRunning) {
      if (api?.listening) {
        api.close()
        await once(api, 'close')
      }
      anvil.kill()
    }
  }
}

main().catch((e) => {
  console.error('\nE2E 실패:', e)
  process.exitCode = 1
})
