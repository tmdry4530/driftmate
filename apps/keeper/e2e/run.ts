/**
 * 최소 루프 E2E (T21).
 *
 * 실제 EVM 노드 위에서 예치 → 위임 → 가격 이동 → 판단 → 실행 → 기록 → 신뢰 반영까지
 * 한 번에 돌린다. 여기까지 통과해야 "동작한다"고 말할 수 있다.
 *
 * 실행: pnpm e2e
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bps, computeTrust } from '@soon/engine'
import { CostMeter } from '../src/payment.js'
import { VaultBudgetAdapter } from '../src/vaultBudgetAdapter.js'
import { Keeper } from '../src/keeper.js'
import { ViemChainReader, ViemVaultWriter } from '../src/viemAdapters.js'
import { loadTrackRecords } from '../src/records.js'
import { startApi } from '../src/server.js'
import { erc20Abi, vaultAbi } from '../src/abi.js'

const PORT = 8546
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

function artifact(name: string): Artifact {
  return JSON.parse(readFileSync(`${OUT}/${name}.sol/${name}.json`, 'utf8')) as Artifact
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
): Promise<Address> {
  const a = artifact(name)
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

/** KEEP=1이면 검증 후 환경을 띄운 채로 둔다 — 화면에서 실제 데이터를 보려고. */
const KEEP = process.env.KEEP === '1'

async function main() {
  console.log('\n▶ Anvil 시작')
  const anvil = await startAnvil()
  let keepRunning = false

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
      await pub.waitForTransactionReceipt({ hash })
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
    await send(vault, VAULT, 'setDelegation', [
      {
        executor: executor.address,
        quoteAsset: usdc,
        maxTradeValue: 3_000n * 10n ** 6n, // $3000 하드캡
        // 초기 신뢰 50점이면 재량은 상한의 55%다. 자동 실행 경로를 보려면
        // 예상 거래 규모($약 770)가 그 55% 안에 들어와야 한다.
        autoThreshold: 2_000n * 10n ** 6n,
        budget: 5_000n * 10n ** 6n,
        expiry: now + 30n * 24n * 3600n,
        allowedAssets: [token, usdc],
        allowedDexes: [dex],
      },
    ])
    check('예치와 위임이 온체인에 기록됨', await pub.readContract({ address: vault, abi: VAULT, functionName: 'isActive' }))

    // --- Keeper 구성 -------------------------------------------------------
    const reader = new ViemChainReader(pub)
    const writer = new ViemVaultWriter(executorWallet, pub)
    const adapter = new VaultBudgetAdapter(writer, vault, {
      price_data: 500_000n, // $0.5
      narration: 200_000n,
    })
    const readRecords = () => loadTrackRecords(pub, vault, usdc)
    const meter = new CostMeter(adapter, async () =>
      (await reader.readDelegation(vault)).budget - (await reader.readBudgetSpent(vault)),
    )
    const keeper = new Keeper(reader, writer, meter, {
      vault, pool: dex,
      characterId: 'timid',
      target: { weights: [{ asset: token, bps: bps(6_000) }, { asset: usdc, bps: bps(4_000) }] },
      assets: [token, usdc],
      slippageToleranceBps: bps(100),
      maxAgeBlocks: 20n,
      approvalTtlBlocks: 50n,
      gasValueEstimate: 100_000n,
    }, readRecords)

    // --- 2. 밴드 안에서는 거래하지 않는다 -----------------------------------
    console.log('\n▶ 2. 균형 상태에서 tick')
    const idle = await keeper.tick()
    check('밴드 안이라 거래를 만들지 않음', idle.kind === 'skipped', idle.kind)
    check('무거래 판단도 온체인에 남음', (await readRecords()).some((r) => r.kind === 'not_executed'))

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
      const frictionBps = Number(((executed.frictionQuote + cost) * 10_000n) / executed.valueQuote)
      check('마찰비용이 계산됨', executed.valueQuote > 0n, `규모=${executed.valueQuote} 마찰=${frictionBps}bp`)
      // 슬리피지가 0이면 주소 비교가 어긋나 quote 자산을 못 알아본 것이다.
      // 운영비만 잡혀도 "마찰이 계산됨"은 통과하므로 따로 확인한다.
      check('슬리피지가 잡힘', executed.frictionQuote > 0n, `슬리피지=${executed.frictionQuote}`)
      check('운영비가 마찰에 포함됨', cost > 0n, `운영비=${cost}`)

      // 실행된 바로 그 판단의 근거를 찾는다. 첫 판단은 균형 상태라 이탈이 0이다.
      const decided = afterExec.find(
        (r) => r.kind === 'decided' && r.decisionId === executed.decisionId,
      )
      check('판단 근거가 온체인에서 복원됨', decided !== undefined)
      if (decided?.kind === 'decided') {
        check(
          '근거에 실제 이탈폭이 담김',
          (decided.evidence.driftBps as number) > 0,
          `drift=${decided.evidence.driftBps}bp`,
        )
        check('근거에 자산별 비중이 담김', decided.evidence.weights.length === 2)
      }
    }
    const trust = computeTrust(afterExec)
    check('신뢰가 기록에서 재현됨', trust.contributions.length > 0, `score=${trust.score}`)
    check('신뢰가 사용자 상한을 넘지 않음', (trust.discretionBps as number) <= 10_000)

    // --- 6. 승인 요청 경로 --------------------------------------------------
    console.log('\n▶ 6. 신뢰를 떨어뜨려 승인 요청 경로 확인')
    for (let i = 0; i < 4; i++) {
      await send(vault, VAULT, 'signalDisappointment', [])
    }
    const lowTrust = computeTrust(await readRecords())
    check('실망 표시로 신뢰가 내려감', lowTrust.score < trust.score, `${trust.score} → ${lowTrust.score}`)
    check('재량도 함께 좁아짐', (lowTrust.discretionBps as number) < (trust.discretionBps as number))

    await send(usdc, ERC20, 'mint', [owner.address, 20_000_000n * 10n ** 6n])
    await send(dex, DEX, 'swap', [usdc, 20_000_000n * 10n ** 6n, 0n, owner.address])
    const asked = await keeper.tick()
    check('임계값을 넘어 승인을 요청함', asked.kind === 'asked' || asked.kind === 'executed', asked.kind)

    if (asked.kind === 'asked') {
      const done = await keeper.approve(asked.decisionId)
      check('승인하면 실행됨', done.kind === 'executed', done.kind)
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
          `VITE_KEEPER_URL=http://127.0.0.1:8945`,
          '',
        ].join('\n'),
      )
      startApi(keeper, 8945)
      keepRunning = true
      console.log(`\n▶ 환경 유지 중`)
      console.log(`  RPC        ${RPC}`)
      console.log(`  Keeper API http://127.0.0.1:8945`)
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
    if (!keepRunning) anvil.kill()
  }
}

main().catch((e) => {
  console.error('\nE2E 실패:', e)
  process.exitCode = 1
})
