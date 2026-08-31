/**
 * 컨트랙트 인터페이스. viem의 human-readable ABI로 직접 적어 빌드 산출물 의존을 없앤다.
 * 시그니처가 컨트랙트와 어긋나면 통합 테스트에서 드러난다.
 */
export const vaultAbi = [
  'function deposit(address token, uint256 amount)',
  'function withdraw(address token, uint256 amount)',
  'function revoke()',
  'function signalDisappointment()',
  'function budgetSpent() view returns (uint256)',
  'function budgetRemaining() view returns (uint256)',
  'function isActive() view returns (bool)',
  'function decisionUsed(bytes32) view returns (bool)',
  'function isAllowedAsset(address) view returns (bool)',
  'function isAllowedDex(address) view returns (bool)',
  'function delegation() view returns ((address executor, address quoteAsset, uint256 maxTradeValue, uint256 autoThreshold, uint256 budget, uint64 expiry, address[] allowedAssets, address[] allowedDexes))',
  'function setDelegation((address executor, address quoteAsset, uint256 maxTradeValue, uint256 autoThreshold, uint256 budget, uint64 expiry, address[] allowedAssets, address[] allowedDexes) d)',
  'function execute((address dex, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) o, bytes32 decisionId, bytes32 characterId, bytes evidence) returns (uint256)',
  'function chargeCost(uint256 amount, bytes32 decisionId, uint8 kind)',
  'function recordNotExecuted(bytes32 decisionId, bytes32 characterId, bytes evidence, uint8 reason)',
  'event Decided(bytes32 indexed decisionId, bytes32 indexed characterId, uint256 blockRef, bytes evidence)',
  'event Executed(bytes32 indexed decisionId, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 valueQuote)',
  'event NotExecuted(bytes32 indexed decisionId, uint8 reason)',
  'event CostCharged(bytes32 indexed decisionId, uint256 amount, uint8 kind)',
  'event Disappointed(uint256 blockRef)',
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

/** NotExecuted 이벤트의 reason 코드. 컨트랙트 주석과 일치해야 한다. */
export const NOT_EXECUTED_REASON = {
  rejected: 0,
  expired: 1,
  cost_exceeds_benefit: 2,
  slippage: 3,
  stale_price: 4,
  budget_exhausted: 5,
  within_band: 6,
  below_min_trade: 7,
} as const

export const COST_KIND = {
  price_data: 0,
  narration: 1,
} as const
