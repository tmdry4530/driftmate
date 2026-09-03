import type {
  Address,
  DecisionId,
  PendingDecision,
  PortfolioBaseline,
  TradeIntent,
} from '@soon/shared'
import { bps } from '@soon/engine'
import { hexToString, parseAbi, type PublicClient, type WalletClient } from 'viem'
import { dexAbi, erc20Abi, vaultAbi } from './abi.js'
import type {
  ChainReader,
  DecisionWrite,
  OnChainDelegation,
  PendingRequest,
  VaultWriter,
} from './ports.js'
import { loadPendingRequest } from './records.js'

const VAULT_ABI = parseAbi(vaultAbi)
const DEX_ABI = parseAbi(dexAbi)
const ERC20_ABI = parseAbi(erc20Abi)

function decodeBytes32(value: `0x${string}`): string {
  return hexToString(value, { size: 32 }).replace(/\0+$/, '')
}

export class ViemChainReader implements ChainReader {
  constructor(private readonly client: PublicClient) {}

  async getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber({ cacheTime: 0 })
  }

  async getBlockTimestamp(blockNumber: bigint): Promise<bigint> {
    return (await this.client.getBlock({ blockNumber })).timestamp
  }

  async readSpotPriceE18(pool: Address, asset: Address, blockNumber: bigint): Promise<bigint> {
    return this.client.readContract({
      address: pool,
      abi: DEX_ABI,
      functionName: 'getSpotPriceE18',
      args: [asset],
      blockNumber,
    })
  }

  async readAmountOut(pool: Address, tokenIn: Address, amountIn: bigint, blockNumber: bigint): Promise<bigint> {
    return this.client.readContract({
      address: pool,
      abi: DEX_ABI,
      functionName: 'getAmountOut',
      args: [tokenIn, amountIn],
      blockNumber,
    })
  }

  async readBalance(token: Address, account: Address, blockNumber: bigint): Promise<bigint> {
    return this.client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account],
      blockNumber,
    })
  }

  async readDelegation(vault: Address, blockNumber: bigint): Promise<OnChainDelegation> {
    const [d, delegationId, configHash, stateNonce, budgetSpent, operatingSpent] = await Promise.all([
      this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'delegation', blockNumber }),
      this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'delegationId', blockNumber }),
      this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'configHash', blockNumber }),
      this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'stateNonce', blockNumber }),
      this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'budgetSpent', blockNumber }),
      this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'operatingSpent', blockNumber }),
    ])
    return {
      delegationId,
      configHash,
      stateNonce,
      executor: d.executor,
      characterId: decodeBytes32(d.characterId),
      strategyHash: d.strategyHash,
      trustFormulaVersion: d.trustFormulaVersion,
      quoteAsset: d.quoteAsset,
      maxTradeValue: d.maxTradeValue,
      autoThreshold: d.autoThreshold,
      budget: d.budget,
      budgetSpent,
      operatingCap: d.operatingCap,
      operatingSpent,
      expiry: d.expiry,
      approvalTtlSeconds: d.approvalTtlSeconds,
      slippageToleranceBps: bps(d.slippageToleranceBps),
      targetAsset: d.targetAsset,
      targetAssetBps: bps(d.targetAssetBps),
      allowedAssets: [...d.allowedAssets],
      allowedDexes: [...d.allowedDexes],
    }
  }

  async readPortfolioBaseline(vault: Address, blockNumber: bigint): Promise<PortfolioBaseline> {
    const value = await this.client.readContract({
      address: vault,
      abi: VAULT_ABI,
      functionName: 'portfolioBaseline',
      blockNumber,
    })
    return {
      delegationId: value.delegationId,
      characterId: decodeBytes32(value.characterId) as PortfolioBaseline['characterId'],
      quoteAsset: value.quoteAsset,
      pricingDex: value.pricingDex,
      targetAsset: value.targetAsset,
      targetBalance: value.targetBalance,
      quoteBalance: value.quoteBalance,
      targetPriceE18: value.targetPriceE18,
      valueQuote: value.valueQuote,
      blockNumber: value.blockRef,
    }
  }

  async readPendingDecision(vault: Address, blockNumber: bigint): Promise<PendingDecision> {
    const value = await this.client.readContract({
      address: vault,
      abi: VAULT_ABI,
      functionName: 'pendingDecision',
      blockNumber,
    })
    return {
      delegationId: value.delegationId,
      proposalNonce: value.proposalNonce,
      decisionId: value.decisionId,
      orderHash: value.orderHash,
      evidenceHash: value.evidenceHash,
      expiresAt: value.expiresAt,
      open: value.open,
    }
  }

  async readPendingRequest(
    vault: Address,
    pending: PendingDecision,
    blockNumber: bigint,
  ): Promise<PendingRequest | undefined> {
    return loadPendingRequest(this.client, vault, pending, blockNumber)
  }

  async readNarrationCostRecorded(
    vault: Address,
    delegationId: bigint,
    decisionId: DecisionId,
    blockNumber: bigint,
  ): Promise<boolean> {
    return this.client.readContract({
      address: vault,
      abi: VAULT_ABI,
      functionName: 'narrationCostRecorded',
      args: [delegationId, decisionId],
      blockNumber,
    })
  }
}

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
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error(`${functionName} 트랜잭션이 실패했다`)
    return hash
  }

  private order(dex: Address, trade: TradeIntent) {
    return {
      dex,
      tokenIn: trade.tokenIn,
      tokenOut: trade.tokenOut,
      amountIn: trade.amountIn,
      minAmountOut: trade.minAmountOut,
    }
  }

  async executeAuto(args: DecisionWrite & { dex: Address; trade: TradeIntent }): Promise<`0x${string}`> {
    return this.send(args.vault, 'executeAuto', [
      args.delegationId,
      args.stateNonce,
      this.order(args.dex, args.trade),
      args.decisionId,
      args.evidence,
      args.priceCost,
    ])
  }

  async propose(args: DecisionWrite & { dex: Address; trade: TradeIntent }): Promise<`0x${string}`> {
    return this.send(args.vault, 'propose', [
      args.delegationId,
      args.stateNonce,
      this.order(args.dex, args.trade),
      args.decisionId,
      args.evidence,
      args.priceCost,
    ])
  }

  async recordNotExecuted(args: DecisionWrite & { reason: number }): Promise<`0x${string}`> {
    return this.send(args.vault, 'recordNotExecuted', [
      args.delegationId,
      args.stateNonce,
      args.decisionId,
      args.evidence,
      args.reason,
      args.priceCost,
    ])
  }

  async expire(args: {
    vault: Address
    delegationId: bigint
    stateNonce: bigint
    decisionId: DecisionId
  }): Promise<`0x${string}`> {
    return this.send(args.vault, 'expire', [args.delegationId, args.stateNonce, args.decisionId])
  }

  async chargeNarrationCost(args: {
    vault: Address
    delegationId: bigint
    amount: bigint
    decisionId: DecisionId
  }): Promise<`0x${string}`> {
    return this.send(args.vault, 'chargeNarrationCost', [args.delegationId, args.decisionId, args.amount])
  }
}
