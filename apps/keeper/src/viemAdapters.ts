import type { Address, CostKind, DecisionId, TradeIntent } from '@soon/shared'
import { parseAbi, stringToHex, type PublicClient, type WalletClient } from 'viem'
import { dexAbi, erc20Abi, vaultAbi } from './abi.js'
import { COST_KIND } from './abi.js'
import type { ChainReader, OnChainDelegation, VaultWriter } from './ports.js'

const VAULT_ABI = parseAbi(vaultAbi)
const DEX_ABI = parseAbi(dexAbi)
const ERC20_ABI = parseAbi(erc20Abi)

/** 읽기 전용 체인 접근을 viem으로 구현한다. */
export class ViemChainReader implements ChainReader {
  constructor(private readonly client: PublicClient) {}

  async getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber()
  }

  async getBlockTimestamp(): Promise<bigint> {
    const block = await this.client.getBlock()
    return block.timestamp
  }

  async readSpotPriceE18(pool: Address, asset: Address): Promise<bigint> {
    return this.client.readContract({
      address: pool,
      abi: DEX_ABI,
      functionName: 'getSpotPriceE18',
      args: [asset],
    })
  }

  async readBalance(token: Address, account: Address): Promise<bigint> {
    return this.client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account],
    })
  }

  async readDelegation(vault: Address): Promise<OnChainDelegation> {
    const d = await this.client.readContract({
      address: vault,
      abi: VAULT_ABI,
      functionName: 'delegation',
    })
    return {
      executor: d.executor,
      quoteAsset: d.quoteAsset,
      maxTradeValue: d.maxTradeValue,
      autoThreshold: d.autoThreshold,
      budget: d.budget,
      expiry: BigInt(d.expiry),
      allowedAssets: [...d.allowedAssets],
      allowedDexes: [...d.allowedDexes],
    }
  }

  async readBudgetSpent(vault: Address): Promise<bigint> {
    return this.client.readContract({
      address: vault,
      abi: VAULT_ABI,
      functionName: 'budgetSpent',
    })
  }
}

/**
 * 쓰기 접근. 이 클라이언트의 키는 볼트의 execute·chargeCost·recordNotExecuted만
 * 부를 수 있다. 인출 함수는 owner 전용이라 여기서 호출해도 되돌려진다 (ADR-0001).
 */
export class ViemVaultWriter implements VaultWriter {
  constructor(
    private readonly wallet: WalletClient,
    private readonly publicClient: PublicClient,
  ) {}

  private async send(address: Address, functionName: string, args: readonly unknown[]) {
    const account = this.wallet.account
    if (!account) throw new Error('실행자 계정이 없다')

    const { request } = await this.publicClient.simulateContract({
      address,
      abi: VAULT_ABI,
      functionName: functionName as never,
      args: args as never,
      account,
    })
    const hash = await this.wallet.writeContract(request)
    await this.publicClient.waitForTransactionReceipt({ hash })
    return hash
  }

  async execute(args: {
    vault: Address
    dex: Address
    trade: TradeIntent
    decisionId: DecisionId
    characterId: string
    evidence: `0x${string}`
  }): Promise<`0x${string}`> {
    return this.send(args.vault, 'execute', [
      {
        dex: args.dex,
        tokenIn: args.trade.tokenIn,
        tokenOut: args.trade.tokenOut,
        amountIn: args.trade.amountIn,
        minAmountOut: args.trade.minAmountOut,
      },
      args.decisionId,
      stringToHex(args.characterId, { size: 32 }),
      args.evidence,
    ])
  }

  async chargeCost(args: {
    vault: Address
    amount: bigint
    decisionId: DecisionId
    kind: CostKind
  }): Promise<`0x${string}`> {
    return this.send(args.vault, 'chargeCost', [args.amount, args.decisionId, COST_KIND[args.kind]])
  }

  async recordNotExecuted(args: {
    vault: Address
    decisionId: DecisionId
    characterId: string
    evidence: `0x${string}`
    reason: number
  }): Promise<`0x${string}`> {
    return this.send(args.vault, 'recordNotExecuted', [
      args.decisionId,
      stringToHex(args.characterId, { size: 32 }),
      args.evidence,
      args.reason,
    ])
  }
}
