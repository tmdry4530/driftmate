export const vaultAbi = [
  'function deposit(address token, uint256 amount)',
  'function withdraw(address token, uint256 amount)',
  'function revoke()',
  'function signalDisappointment(uint256 expectedDelegationId, bytes32 reportId)',
  'function budgetSpent() view returns (uint256)',
  'function operatingSpent() view returns (uint256)',
  'function budgetRemaining() view returns (uint256)',
  'function delegationId() view returns (uint256)',
  'function stateNonce() view returns (uint256)',
  'function configHash() view returns (bytes32)',
  'function isActive() view returns (bool)',
  'function decisionRecorded(uint256, bytes32) view returns (bool)',
  'function outcomeRecorded(uint256, bytes32) view returns (bool)',
  'function narrationCostRecorded(uint256, bytes32) view returns (bool)',
  'function isAllowedAsset(address) view returns (bool)',
  'function isAllowedDex(address) view returns (bool)',
  'function delegation() view returns ((address executor, bytes32 characterId, bytes32 strategyHash, uint32 trustFormulaVersion, address quoteAsset, uint256 maxTradeValue, uint256 autoThreshold, uint256 budget, uint256 operatingCap, uint64 expiry, uint64 approvalTtlSeconds, uint16 slippageToleranceBps, address targetAsset, uint16 targetAssetBps, address[] allowedAssets, address[] allowedDexes))',
  'function portfolioBaseline() view returns ((uint256 delegationId, bytes32 characterId, address quoteAsset, address pricingDex, address targetAsset, uint256 targetBalance, uint256 quoteBalance, uint256 targetPriceE18, uint256 valueQuote, uint256 blockRef))',
  'function pendingDecision() view returns ((uint256 delegationId, uint256 proposalNonce, bytes32 decisionId, bytes32 orderHash, bytes32 evidenceHash, uint64 expiresAt, bool open))',
  'function setDelegation((address executor, bytes32 characterId, bytes32 strategyHash, uint32 trustFormulaVersion, address quoteAsset, uint256 maxTradeValue, uint256 autoThreshold, uint256 budget, uint256 operatingCap, uint64 expiry, uint64 approvalTtlSeconds, uint16 slippageToleranceBps, address targetAsset, uint16 targetAssetBps, address[] allowedAssets, address[] allowedDexes) d)',
  'function executeAuto(uint256 expectedDelegationId, uint256 expectedStateNonce, (address dex, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) o, bytes32 decisionId, bytes evidence, uint256 priceCost) returns (uint256)',
  'function propose(uint256 expectedDelegationId, uint256 expectedStateNonce, (address dex, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) o, bytes32 decisionId, bytes evidence, uint256 priceCost)',
  'function recordNotExecuted(uint256 expectedDelegationId, uint256 expectedStateNonce, bytes32 decisionId, bytes evidence, uint8 reason, uint256 priceCost)',
  'function chargeNarrationCost(uint256 expectedDelegationId, bytes32 decisionId, uint256 amount)',
  'function executeApproved(uint256 expectedDelegationId, uint256 expectedStateNonce, bytes32 decisionId, (address dex, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) o) returns (uint256)',
  'function reject(uint256 expectedDelegationId, uint256 expectedStateNonce, bytes32 decisionId)',
  'function expire(uint256 expectedDelegationId, uint256 expectedStateNonce, bytes32 decisionId)',
  'function finalizePendingFailure(uint256 expectedDelegationId, uint256 expectedStateNonce, bytes32 decisionId, uint8 reason)',
  'event DelegationSet(uint256 indexed delegationId, bytes32 indexed characterId, bytes32 configHash)',
  'event PortfolioBaseline(uint256 indexed delegationId, bytes32 indexed characterId, address indexed quoteAsset, address pricingDex, address targetAsset, uint256 targetBalance, uint256 quoteBalance, uint256 targetPriceE18, uint256 valueQuote, uint256 blockRef)',
  'event Decided(bytes32 indexed decisionId, uint256 indexed delegationId, bytes32 indexed characterId, uint32 trustFormulaVersion, uint256 blockRef, bytes evidence)',
  'event ApprovalRequested(bytes32 indexed decisionId, uint256 indexed delegationId, address dex, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes32 orderHash, bytes32 evidenceHash, uint64 expiresAt)',
  'event Executed(bytes32 indexed decisionId, uint256 indexed delegationId, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 valueInQuote, uint256 valueOutQuote)',
  'event NotExecuted(bytes32 indexed decisionId, uint256 indexed delegationId, uint8 reason)',
  'event CostCharged(bytes32 indexed decisionId, uint256 indexed delegationId, uint256 amount, uint8 kind)',
  'event Disappointed(uint256 indexed delegationId, bytes32 indexed characterId, bytes32 indexed reportId, uint256 blockRef)',
] as const

export const dexAbi = [
  'function getSpotPriceE18(address tokenIn) view returns (uint256)',
  'function getAmountOut(address tokenIn, uint256 amountIn) view returns (uint256)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
] as const

export const erc20Abi = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)',
] as const

export const NOT_EXECUTED_REASON = {
  rejected: 0,
  expired: 1,
  cost_exceeds_benefit: 2,
  slippage: 3,
  stale_price: 4,
  budget_exhausted: 5,
  within_band: 6,
  below_min_trade: 7,
  execution_failed: 8,
} as const

export const COST_KIND = {
  price_data: 0,
  narration: 1,
} as const
