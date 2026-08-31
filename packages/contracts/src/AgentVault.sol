// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IMockDex {
    function getSpotPriceE18(address tokenIn) external view returns (uint256);
    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut, address to)
        external
        returns (uint256 amountOut);
}

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title AgentVault
 * @notice 사용자가 운용할 금액만 담아두는 격리 볼트. 한도 강제의 최종 방어선이다.
 *
 * 오프체인 게이트도 같은 한도를 검사하지만 그것은 UX를 위한 것이고, 실제 방어선은
 * 여기다 (R6.2). 실행자 코드에 버그가 있거나 키가 유출되어도 사용자가 서명한 한도를
 * 넘을 수 없어야 한다.
 *
 * 비수탁: 자산이 볼트 밖으로 나가는 유일한 경로는 owner 주소다. 실행자는 볼트 안에서
 * 화이트리스트된 DEX를 상대로 한도 내 스왑만 할 수 있고, 인출은 할 수 없다.
 *
 * 대안(ERC-20 approve, EIP-7702 위임, ERC-7715 툴킷)과의 비교는 ADR-0001을 참고.
 */
contract AgentVault {
    struct Delegation {
        address executor; // 자동 실행을 수행할 주소
        address quoteAsset; // 한도를 재는 기준 자산. 거래 가치를 이 자산으로 환산한다
        uint256 maxTradeValue; // 1회 최대 거래 금액. 승인해도 넘을 수 없는 하드캡 (R5.6)
        uint256 autoThreshold; // 자동 실행 임계값. 신뢰는 이 안에서만 움직인다 (R5.7)
        uint256 budget; // 거래와 운영비가 공유하는 단일 예산 (R3.7)
        uint64 expiry;
        address[] allowedAssets;
        address[] allowedDexes;
    }

    address public immutable owner;

    Delegation private _delegation;
    mapping(address => bool) public isAllowedAsset;
    mapping(address => bool) public isAllowedDex;

    /// @notice 예산에서 이미 쓴 금액. 거래와 운영비가 함께 누적된다 (R3.7, R11.6).
    uint256 public budgetSpent;

    /// @notice 이미 처리한 판단. 같은 판단이 두 번 실행되지 않게 한다 (R6.6).
    mapping(bytes32 => bool) public decisionUsed;

    uint256 private constant PRICE_SCALE = 1e18;

    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount);
    event DelegationSet(
        address indexed executor, uint256 maxTradeValue, uint256 autoThreshold, uint256 budget, uint64 expiry
    );
    event DelegationRevoked();

    /// @notice 판단이 내려졌다는 사실. 실행 여부와 무관하게 항상 남는다 (R7.1).
    event Decided(bytes32 indexed decisionId, bytes32 indexed characterId, uint256 blockRef, bytes evidence);
    event Executed(
        bytes32 indexed decisionId, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 valueQuote
    );
    /// @notice 실행되지 않은 판단도 남긴다. 성공 사례만 쌓이는 편향을 막는다 (R7.4).
    event NotExecuted(bytes32 indexed decisionId, uint8 reason);
    /// @notice 판단에 든 운영비. 순성과 계산의 입력이 된다 (R7.6, R11.5).
    event CostCharged(bytes32 indexed decisionId, uint256 amount, uint8 kind);
    /// @notice 사용자가 실망을 표시함. 신뢰가 즉시 내려간다 (R10.6).
    event Disappointed(uint256 blockRef);

    error NotOwner();
    error NotExecutor();
    error DelegationInactive();
    error DelegationExpired();
    error ZeroExecutor();
    error AssetNotAllowed();
    error DexNotAllowed();
    error ExceedsMaxTradeValue();
    error BudgetExhausted();
    error DecisionAlreadyUsed();
    error SlippageTooHigh();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyExecutor() {
        if (msg.sender != _delegation.executor || _delegation.executor == address(0)) {
            revert NotExecutor();
        }
        if (_delegation.expiry == 0) revert DelegationInactive();
        // 기간이 지나면 자동 실행이 멈춘다 (R3.4).
        if (block.timestamp > _delegation.expiry) revert DelegationExpired();
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    // --- 자산 ---------------------------------------------------------------

    function deposit(address token, uint256 amount) external onlyOwner {
        IERC20Minimal(token).transferFrom(msg.sender, address(this), amount);
        emit Deposited(token, amount);
    }

    /**
     * @notice 인출. 수신자는 항상 owner다.
     * @dev 수신자를 인자로 받지 않는 것이 의도다 — 실행자가 자산을 빼낼 경로 자체를 없앤다.
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20Minimal(token).transfer(owner, amount);
        emit Withdrawn(token, amount);
    }

    // --- 위임 ---------------------------------------------------------------

    /**
     * @notice 위임 범위를 설정한다. owner가 직접 서명해야 한다 (R3.3).
     * @dev 재설정하면 사용한 예산이 초기화된다 — 새로 서명한 예산이 새 기준이 된다.
     */
    function setDelegation(Delegation calldata d) external onlyOwner {
        if (d.executor == address(0)) revert ZeroExecutor();

        // 이전 허용 목록을 지우고 새로 세운다.
        address[] memory prevAssets = _delegation.allowedAssets;
        for (uint256 i = 0; i < prevAssets.length; i++) {
            isAllowedAsset[prevAssets[i]] = false;
        }
        address[] memory prevDexes = _delegation.allowedDexes;
        for (uint256 i = 0; i < prevDexes.length; i++) {
            isAllowedDex[prevDexes[i]] = false;
        }

        _delegation = d;
        budgetSpent = 0;

        for (uint256 i = 0; i < d.allowedAssets.length; i++) {
            isAllowedAsset[d.allowedAssets[i]] = true;
        }
        for (uint256 i = 0; i < d.allowedDexes.length; i++) {
            isAllowedDex[d.allowedDexes[i]] = true;
        }

        emit DelegationSet(d.executor, d.maxTradeValue, d.autoThreshold, d.budget, d.expiry);
    }

    /**
     * @notice 위임 철회. 즉시 자동 실행이 멈춘다 (R3.5).
     */
    function revoke() external onlyOwner {
        address[] memory prevAssets = _delegation.allowedAssets;
        for (uint256 i = 0; i < prevAssets.length; i++) {
            isAllowedAsset[prevAssets[i]] = false;
        }
        address[] memory prevDexes = _delegation.allowedDexes;
        for (uint256 i = 0; i < prevDexes.length; i++) {
            isAllowedDex[prevDexes[i]] = false;
        }

        delete _delegation;
        emit DelegationRevoked();
    }

    // --- 실행 ---------------------------------------------------------------

    struct SwapOrder {
        address dex;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
    }

    /**
     * @notice 거래 가치를 quote 자산 기준으로 환산한다.
     * @dev 실행자가 넘긴 값을 쓰지 않고 볼트가 직접 DEX에서 읽는다.
     *      실행자가 가치를 낮게 신고해 한도를 우회하는 경로를 없앤다.
     */
    function _valueInQuote(address dex, address tokenIn, uint256 amountIn) private view returns (uint256) {
        if (tokenIn == _delegation.quoteAsset) return amountIn;
        return (amountIn * IMockDex(dex).getSpotPriceE18(tokenIn)) / PRICE_SCALE;
    }

    function _consumeBudget(uint256 value) private {
        uint256 spent = budgetSpent + value;
        if (spent > _delegation.budget) revert BudgetExhausted();
        budgetSpent = spent;
    }

    function _recordDecision(bytes32 decisionId, bytes32 characterId, bytes calldata evidence) private {
        if (decisionUsed[decisionId]) revert DecisionAlreadyUsed();
        decisionUsed[decisionId] = true;
        emit Decided(decisionId, characterId, block.number, evidence);
    }

    /**
     * @notice 스왑을 실행한다. 실행자만 호출할 수 있다.
     *
     * 오프체인 게이트가 이미 같은 검사를 했지만 여기서 다시 검증한다 (R6.2).
     * 이 함수가 통과시키지 않는 것은 어떤 경로로도 일어날 수 없다.
     */
    function execute(SwapOrder calldata o, bytes32 decisionId, bytes32 characterId, bytes calldata evidence)
        external
        onlyExecutor
        returns (uint256 amountOut)
    {
        if (!isAllowedDex[o.dex]) revert DexNotAllowed();
        // 허용 목록 밖 토큰은 어떤 경우에도 거래하지 않는다 (R3.6).
        if (!isAllowedAsset[o.tokenIn] || !isAllowedAsset[o.tokenOut]) revert AssetNotAllowed();

        _recordDecision(decisionId, characterId, evidence);

        uint256 valueQuote = _valueInQuote(o.dex, o.tokenIn, o.amountIn);
        // 하드캡은 사용자가 승인해도 넘을 수 없다 (R5.6).
        if (valueQuote > _delegation.maxTradeValue) revert ExceedsMaxTradeValue();
        _consumeBudget(valueQuote);

        IERC20Minimal(o.tokenIn).approve(o.dex, o.amountIn);
        uint256 balanceBefore = IERC20Minimal(o.tokenOut).balanceOf(address(this));
        amountOut = IMockDex(o.dex).swap(o.tokenIn, o.amountIn, o.minAmountOut, address(this));
        uint256 received = IERC20Minimal(o.tokenOut).balanceOf(address(this)) - balanceBefore;

        // DEX도 검사하지만 실제로 들어온 양으로 한 번 더 확인한다 (R6.4).
        if (received < o.minAmountOut) revert SlippageTooHigh();
        IERC20Minimal(o.tokenIn).approve(o.dex, 0);

        emit Executed(decisionId, o.tokenIn, o.tokenOut, o.amountIn, received, valueQuote);
    }

    /**
     * @notice 실행하지 않기로 한 판단을 기록한다 (R7.4).
     * @param reason 0=거절 1=만료 2=비용초과 3=슬리피지 4=가격만료 5=예산소진 6=밴드내 7=최소거래액미만
     */
    function recordNotExecuted(bytes32 decisionId, bytes32 characterId, bytes calldata evidence, uint8 reason)
        external
        onlyExecutor
    {
        _recordDecision(decisionId, characterId, evidence);
        emit NotExecuted(decisionId, reason);
    }

    // --- 운영비 -------------------------------------------------------------

    /**
     * @notice 판단에 든 운영비를 예산에서 차감하고 기록한다 (R11.1).
     *
     * @dev 거래와 **같은 예산**을 쓴다. 운영비 예산이 따로 있었다면 그쪽으로 지출하고
     *      거래 예산을 온전히 남기는 우회가 가능했을 것이다 (R3.7, R11.6).
     *
     *      실제 지불은 여기서 하지 않는다. 이번 범위는 회계까지이고 결제 수단은
     *      PaymentAdapter 뒤에 둔다 (ADR-0004). x402 경로를 붙여도 이 함수는 그대로다.
     * @param kind 0=가격 데이터 1=설명 생성
     */
    function chargeCost(uint256 amount, bytes32 decisionId, uint8 kind) external onlyExecutor {
        _consumeBudget(amount);
        emit CostCharged(decisionId, amount, kind);
    }

    /**
     * @notice 사용자가 손실 보고에 실망을 표시한다 (R10.6).
     * @dev 이 기록이 신뢰 점수를 즉시 끌어내리고 재량을 좁힌다. 회복은 실적으로만 된다 (R10.7).
     */
    function signalDisappointment() external onlyOwner {
        emit Disappointed(block.number);
    }

    // --- 조회 ---------------------------------------------------------------

    function delegation() external view returns (Delegation memory) {
        return _delegation;
    }

    function isActive() external view returns (bool) {
        return _delegation.expiry != 0 && block.timestamp <= _delegation.expiry;
    }

    function budgetRemaining() external view returns (uint256) {
        return _delegation.budget > budgetSpent ? _delegation.budget - budgetSpent : 0;
    }
}
