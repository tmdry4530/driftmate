// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IMockDex {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getSpotPriceE18(address tokenIn) external view returns (uint256);
    function getAmountOut(address tokenIn, uint256 amountIn) external view returns (uint256);
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
        bytes32 characterId;
        bytes32 strategyHash;
        uint32 trustFormulaVersion;
        address quoteAsset; // 한도를 재는 기준 자산. 거래 가치를 이 자산으로 환산한다
        uint256 maxTradeValue; // 1회 최대 거래 금액. 승인해도 넘을 수 없는 하드캡 (R5.6)
        uint256 autoThreshold; // 자동 실행 임계값. 신뢰는 이 안에서만 움직인다 (R5.7)
        uint256 budget; // 거래와 운영비가 공유하는 단일 예산 (R3.7)
        uint256 operatingCap;
        uint64 expiry;
        uint64 approvalTtlSeconds;
        uint16 slippageToleranceBps;
        address targetAsset;
        uint16 targetAssetBps;
        address[] allowedAssets;
        address[] allowedDexes;
    }

    struct PortfolioBaselineData {
        uint256 delegationId;
        bytes32 characterId;
        address quoteAsset;
        address pricingDex;
        address targetAsset;
        uint256 targetBalance;
        uint256 quoteBalance;
        uint256 targetPriceE18;
        uint256 valueQuote;
        uint256 blockRef;
    }

    struct PendingDecision {
        uint256 delegationId;
        uint256 proposalNonce;
        bytes32 decisionId;
        bytes32 orderHash;
        bytes32 evidenceHash;
        uint64 expiresAt;
        bool open;
    }

    address public immutable owner;

    Delegation private _delegation;
    mapping(address => bool) public isAllowedAsset;
    mapping(address => bool) public isAllowedDex;

    /// @notice 예산에서 이미 쓴 금액. 거래와 운영비가 함께 누적된다 (R3.7, R11.6).
    uint256 public budgetSpent;
    uint256 public operatingSpent;
    uint256 public delegationId;
    uint256 public stateNonce;
    bytes32 public configHash;
    PortfolioBaselineData private _portfolioBaseline;

    mapping(uint256 => mapping(bytes32 => bool)) public decisionRecorded;
    mapping(uint256 => mapping(bytes32 => bool)) public outcomeRecorded;
    mapping(uint256 => mapping(bytes32 => bool)) public narrationCostRecorded;
    mapping(uint256 => mapping(bytes32 => bool)) public disappointmentRecorded;
    PendingDecision private _pendingDecision;

    uint256 private constant PRICE_SCALE = 1e18;

    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount);
    event DelegationSet(uint256 indexed delegationId, bytes32 indexed characterId, bytes32 configHash);
    event PortfolioBaseline(
        uint256 indexed delegationId,
        bytes32 indexed characterId,
        address indexed quoteAsset,
        address pricingDex,
        address targetAsset,
        uint256 targetBalance,
        uint256 quoteBalance,
        uint256 targetPriceE18,
        uint256 valueQuote,
        uint256 blockRef
    );
    event DelegationRevoked(uint256 indexed delegationId);

    /// @notice 판단이 내려졌다는 사실. 실행 여부와 무관하게 항상 남는다 (R7.1).
    event Decided(
        bytes32 indexed decisionId,
        uint256 indexed delegationId,
        bytes32 indexed characterId,
        uint32 trustFormulaVersion,
        uint256 blockRef,
        bytes evidence
    );
    event ApprovalRequested(
        bytes32 indexed decisionId,
        uint256 indexed delegationId,
        address dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes32 orderHash,
        bytes32 evidenceHash,
        uint64 expiresAt
    );
    event Executed(
        bytes32 indexed decisionId,
        uint256 indexed delegationId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 valueInQuote,
        uint256 valueOutQuote
    );
    /// @notice 실행되지 않은 판단도 남긴다. 성공 사례만 쌓이는 편향을 막는다 (R7.4).
    event NotExecuted(bytes32 indexed decisionId, uint256 indexed delegationId, uint8 reason);
    /// @notice 판단에 든 운영비. 순성과 계산의 입력이 된다 (R7.6, R11.5).
    event CostCharged(bytes32 indexed decisionId, uint256 indexed delegationId, uint256 amount, uint8 kind);
    /// @notice 사용자가 실망을 표시함. 신뢰가 즉시 내려간다 (R10.6).
    event Disappointed(
        uint256 indexed delegationId, bytes32 indexed characterId, bytes32 indexed reportId, uint256 blockRef
    );

    error NotOwner();
    error NotExecutor();
    error DelegationInactive();
    error DelegationExpired();
    error ZeroExecutor();
    error InvalidCharacter();
    error InvalidStrategyHash();
    error InvalidTrustFormulaVersion();
    error InvalidAssetPair();
    error InvalidDexPair();
    error InvalidLimits();
    error InvalidExpiry();
    error EmptyPortfolio();
    error TokenTransferFailed();
    error WrongDelegation();
    error WrongStateNonce();
    error PendingOpen();
    error NoPending();
    error PendingMismatch();
    error ApprovalExpired();
    error ApprovalNotExpired();
    error AutoThresholdExceeded();
    error InvalidOrder();
    error OutcomeAlreadyRecorded();
    error DecisionNotRecorded();
    error CostAlreadyRecorded();
    error DisappointmentAlreadyRecorded();
    error InvalidReport();
    error AssetNotAllowed();
    error DexNotAllowed();
    error ExceedsMaxTradeValue();
    error BudgetExhausted();
    error OperatingBudgetExhausted();
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
        _revokeIfConfigured();
        _safeTransferFrom(token, msg.sender, address(this), amount);
        emit Deposited(token, amount);
    }

    /**
     * @notice 인출. 수신자는 항상 owner다.
     * @dev 수신자를 인자로 받지 않는 것이 의도다 — 실행자가 자산을 빼낼 경로 자체를 없앤다.
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        _revokeIfConfigured();
        _safeTransfer(token, owner, amount);
        emit Withdrawn(token, amount);
    }

    // --- 위임 ---------------------------------------------------------------

    /**
     * @notice 위임 범위를 설정한다. owner가 직접 서명해야 한다 (R3.3).
     * @dev 재설정하면 사용한 예산이 초기화된다 — 새로 서명한 예산이 새 기준이 된다.
     */
    function setDelegation(Delegation calldata d) external onlyOwner {
        if (d.executor == address(0)) revert ZeroExecutor();
        if (d.characterId == bytes32(0)) revert InvalidCharacter();
        if (d.strategyHash == bytes32(0)) revert InvalidStrategyHash();
        if (d.trustFormulaVersion == 0) revert InvalidTrustFormulaVersion();
        if (
            d.allowedAssets.length != 2 || d.targetAsset == d.quoteAsset
                || !_containsPair(d.allowedAssets, d.targetAsset, d.quoteAsset)
        ) revert InvalidAssetPair();
        if (d.allowedDexes.length != 1 || !_matchesPair(d.allowedDexes[0], d.targetAsset, d.quoteAsset)) {
            revert InvalidDexPair();
        }
        if (
            d.targetAssetBps > 10_000 || d.autoThreshold > d.maxTradeValue || d.operatingCap > d.budget
                || d.slippageToleranceBps > 10_000
        ) revert InvalidLimits();
        if (d.expiry <= block.timestamp || d.approvalTtlSeconds == 0) revert InvalidExpiry();

        uint256 targetBalance = IERC20Minimal(d.targetAsset).balanceOf(address(this));
        uint256 quoteBalance = IERC20Minimal(d.quoteAsset).balanceOf(address(this));
        uint256 targetPriceE18 = IMockDex(d.allowedDexes[0]).getSpotPriceE18(d.targetAsset);
        uint256 valueQuote = quoteBalance + (targetBalance * targetPriceE18) / PRICE_SCALE;
        if (targetPriceE18 == 0 || valueQuote == 0) revert EmptyPortfolio();

        // 이전 허용 목록을 지우고 새로 세운다.
        _finalizePendingOnSessionEnd();
        _clearAllowLists();

        _delegation = d;
        delegationId++;
        stateNonce = 0;
        budgetSpent = 0;
        operatingSpent = 0;
        configHash = keccak256(abi.encode(d));

        for (uint256 i = 0; i < d.allowedAssets.length; i++) {
            isAllowedAsset[d.allowedAssets[i]] = true;
        }
        for (uint256 i = 0; i < d.allowedDexes.length; i++) {
            isAllowedDex[d.allowedDexes[i]] = true;
        }

        _portfolioBaseline = PortfolioBaselineData({
            delegationId: delegationId,
            characterId: d.characterId,
            quoteAsset: d.quoteAsset,
            pricingDex: d.allowedDexes[0],
            targetAsset: d.targetAsset,
            targetBalance: targetBalance,
            quoteBalance: quoteBalance,
            targetPriceE18: targetPriceE18,
            valueQuote: valueQuote,
            blockRef: block.number
        });

        emit DelegationSet(delegationId, d.characterId, configHash);
        emit PortfolioBaseline(
            delegationId,
            d.characterId,
            d.quoteAsset,
            d.allowedDexes[0],
            d.targetAsset,
            targetBalance,
            quoteBalance,
            targetPriceE18,
            valueQuote,
            block.number
        );
    }

    /**
     * @notice 위임 철회. 즉시 자동 실행이 멈춘다 (R3.5).
     */
    function revoke() external onlyOwner {
        _revokeIfConfigured();
    }

    function _revokeIfConfigured() private {
        if (_delegation.expiry == 0) return;
        uint256 revokedDelegationId = delegationId;
        _finalizePendingOnSessionEnd();
        _clearAllowLists();
        delete _delegation;
        delete configHash;
        stateNonce++;
        emit DelegationRevoked(revokedDelegationId);
    }

    function _finalizePendingOnSessionEnd() private {
        if (!_pendingDecision.open) return;
        PendingDecision memory pending = _pendingDecision;
        outcomeRecorded[pending.delegationId][pending.decisionId] = true;
        delete _pendingDecision;
        emit NotExecuted(pending.decisionId, pending.delegationId, 0);
    }

    function _clearAllowLists() private {
        address[] memory prevAssets = _delegation.allowedAssets;
        for (uint256 i = 0; i < prevAssets.length; i++) {
            isAllowedAsset[prevAssets[i]] = false;
        }
        address[] memory prevDexes = _delegation.allowedDexes;
        for (uint256 i = 0; i < prevDexes.length; i++) {
            isAllowedDex[prevDexes[i]] = false;
        }
    }

    function _containsPair(address[] calldata values, address a, address b) private pure returns (bool) {
        return values[0] != values[1] && ((values[0] == a && values[1] == b) || (values[0] == b && values[1] == a));
    }

    function _matchesPair(address dex, address a, address b) private view returns (bool) {
        address token0 = IMockDex(dex).token0();
        address token1 = IMockDex(dex).token1();
        return token0 != token1 && ((token0 == a && token1 == b) || (token0 == b && token1 == a));
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        if (token.code.length == 0) revert TokenTransferFailed();
        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20Minimal.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        if (token.code.length == 0) revert TokenTransferFailed();
        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20Minimal.transferFrom, (from, to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }

    function _safeApprove(address token, address spender, uint256 amount) private {
        if (token.code.length == 0) revert TokenTransferFailed();
        (bool ok, bytes memory data) = token.call(abi.encodeCall(IERC20Minimal.approve, (spender, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
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

    function _chargeOperatingCost(bytes32 decisionId, uint256 amount, uint8 kind) private {
        if (amount == 0) return;
        uint256 spent = operatingSpent + amount;
        if (spent > _delegation.operatingCap) revert OperatingBudgetExhausted();
        _consumeBudget(amount);
        operatingSpent = spent;
        emit CostCharged(decisionId, delegationId, amount, kind);
    }

    function _checkSession(uint256 expectedDelegationId, uint256 expectedStateNonce) private view {
        if (expectedDelegationId != delegationId) revert WrongDelegation();
        if (expectedStateNonce != stateNonce) revert WrongStateNonce();
    }

    function _recordDecision(bytes32 decisionId, bytes calldata evidence) private {
        if (_pendingDecision.open) revert PendingOpen();
        if (decisionId == bytes32(0)) revert InvalidOrder();
        if (decisionRecorded[delegationId][decisionId]) revert DecisionAlreadyUsed();
        decisionRecorded[delegationId][decisionId] = true;
        stateNonce++;
        emit Decided(
            decisionId, delegationId, _delegation.characterId, _delegation.trustFormulaVersion, block.number, evidence
        );
    }

    function _validateOrder(SwapOrder calldata o) private view returns (uint256 valueQuote) {
        if (!isAllowedDex[o.dex]) revert DexNotAllowed();
        if (!isAllowedAsset[o.tokenIn] || !isAllowedAsset[o.tokenOut]) revert AssetNotAllowed();
        if (o.tokenIn == o.tokenOut || o.amountIn == 0) revert InvalidOrder();

        uint256 expectedOut = IMockDex(o.dex).getAmountOut(o.tokenIn, o.amountIn);
        uint256 requiredMin = (expectedOut * (10_000 - _delegation.slippageToleranceBps)) / 10_000;
        if (o.minAmountOut < requiredMin) revert SlippageTooHigh();

        valueQuote = _valueInQuote(o.dex, o.tokenIn, o.amountIn);
        if (valueQuote > _delegation.maxTradeValue) revert ExceedsMaxTradeValue();
        if (budgetSpent + valueQuote > _delegation.budget) revert BudgetExhausted();
    }

    function _swap(SwapOrder calldata o, bytes32 decisionId, uint256 valueQuote) private returns (uint256 amountOut) {
        uint256 outputPriceE18 =
            o.tokenOut == _delegation.quoteAsset ? PRICE_SCALE : IMockDex(o.dex).getSpotPriceE18(o.tokenOut);
        _consumeBudget(valueQuote);

        _safeApprove(o.tokenIn, o.dex, o.amountIn);
        uint256 balanceBefore = IERC20Minimal(o.tokenOut).balanceOf(address(this));
        amountOut = IMockDex(o.dex).swap(o.tokenIn, o.amountIn, o.minAmountOut, address(this));
        uint256 received = IERC20Minimal(o.tokenOut).balanceOf(address(this)) - balanceBefore;

        if (received < o.minAmountOut) revert SlippageTooHigh();
        _safeApprove(o.tokenIn, o.dex, 0);
        amountOut = received;
        uint256 valueOutQuote = (received * outputPriceE18) / PRICE_SCALE;

        outcomeRecorded[delegationId][decisionId] = true;
        emit Executed(decisionId, delegationId, o.tokenIn, o.tokenOut, o.amountIn, received, valueQuote, valueOutQuote);
    }

    function executeAuto(
        uint256 expectedDelegationId,
        uint256 expectedStateNonce,
        SwapOrder calldata o,
        bytes32 decisionId,
        bytes calldata evidence,
        uint256 priceCost
    ) external onlyExecutor returns (uint256 amountOut) {
        _checkSession(expectedDelegationId, expectedStateNonce);
        uint256 valueQuote = _validateOrder(o);
        if (valueQuote > _delegation.autoThreshold) revert AutoThresholdExceeded();
        _recordDecision(decisionId, evidence);
        _chargeOperatingCost(decisionId, priceCost, 0);
        return _swap(o, decisionId, valueQuote);
    }

    function propose(
        uint256 expectedDelegationId,
        uint256 expectedStateNonce,
        SwapOrder calldata o,
        bytes32 decisionId,
        bytes calldata evidence,
        uint256 priceCost
    ) external onlyExecutor {
        _checkSession(expectedDelegationId, expectedStateNonce);
        _validateOrder(o);
        uint64 expiresAt = uint64(block.timestamp + _delegation.approvalTtlSeconds);
        bytes32 orderHash = keccak256(abi.encode(delegationId, expectedStateNonce, decisionId, o, expiresAt));
        bytes32 evidenceHash = keccak256(evidence);

        _recordDecision(decisionId, evidence);
        _chargeOperatingCost(decisionId, priceCost, 0);
        _pendingDecision = PendingDecision({
            delegationId: delegationId,
            proposalNonce: expectedStateNonce,
            decisionId: decisionId,
            orderHash: orderHash,
            evidenceHash: evidenceHash,
            expiresAt: expiresAt,
            open: true
        });
        emit ApprovalRequested(
            decisionId,
            delegationId,
            o.dex,
            o.tokenIn,
            o.tokenOut,
            o.amountIn,
            o.minAmountOut,
            orderHash,
            evidenceHash,
            expiresAt
        );
    }

    function _pending(uint256 expectedDelegationId, uint256 expectedStateNonce, bytes32 decisionId)
        private
        view
        returns (PendingDecision memory pending)
    {
        pending = _pendingDecision;
        if (!pending.open) revert NoPending();
        _checkSession(expectedDelegationId, expectedStateNonce);
        if (pending.delegationId != delegationId || pending.decisionId != decisionId) revert PendingMismatch();
    }

    function executeApproved(
        uint256 expectedDelegationId,
        uint256 expectedStateNonce,
        bytes32 decisionId,
        SwapOrder calldata o
    ) external onlyOwner returns (uint256 amountOut) {
        PendingDecision memory pending = _pending(expectedDelegationId, expectedStateNonce, decisionId);
        if (block.timestamp > _delegation.expiry) revert DelegationExpired();
        if (block.timestamp > pending.expiresAt) revert ApprovalExpired();
        if (
            keccak256(abi.encode(delegationId, pending.proposalNonce, decisionId, o, pending.expiresAt))
                != pending.orderHash
        ) revert PendingMismatch();

        uint256 valueQuote = _validateOrder(o);
        delete _pendingDecision;
        stateNonce++;
        return _swap(o, decisionId, valueQuote);
    }

    function _closePending(uint256 expectedDelegationId, uint256 expectedStateNonce, bytes32 decisionId, uint8 reason)
        private
    {
        PendingDecision memory pending = _pending(expectedDelegationId, expectedStateNonce, decisionId);
        if (outcomeRecorded[pending.delegationId][decisionId]) revert OutcomeAlreadyRecorded();
        outcomeRecorded[pending.delegationId][decisionId] = true;
        delete _pendingDecision;
        stateNonce++;
        emit NotExecuted(decisionId, pending.delegationId, reason);
    }

    function reject(uint256 expectedDelegationId, uint256 expectedStateNonce, bytes32 decisionId) external onlyOwner {
        _closePending(expectedDelegationId, expectedStateNonce, decisionId, 0);
    }

    function expire(uint256 expectedDelegationId, uint256 expectedStateNonce, bytes32 decisionId) external {
        PendingDecision memory pending = _pending(expectedDelegationId, expectedStateNonce, decisionId);
        if (block.timestamp <= pending.expiresAt) revert ApprovalNotExpired();
        _closePending(expectedDelegationId, expectedStateNonce, decisionId, 1);
    }

    function finalizePendingFailure(
        uint256 expectedDelegationId,
        uint256 expectedStateNonce,
        bytes32 decisionId,
        uint8 reason
    ) external onlyOwner {
        _closePending(expectedDelegationId, expectedStateNonce, decisionId, reason);
    }

    /**
     * @notice 실행하지 않기로 한 판단을 기록한다 (R7.4).
     * @param reason 0=거절 1=만료 2=비용초과 3=슬리피지 4=가격만료 5=예산소진 6=밴드내 7=최소거래액미만
     */
    function recordNotExecuted(
        uint256 expectedDelegationId,
        uint256 expectedStateNonce,
        bytes32 decisionId,
        bytes calldata evidence,
        uint8 reason,
        uint256 priceCost
    ) external onlyExecutor {
        _checkSession(expectedDelegationId, expectedStateNonce);
        _recordDecision(decisionId, evidence);
        _chargeOperatingCost(decisionId, priceCost, 0);
        outcomeRecorded[delegationId][decisionId] = true;
        emit NotExecuted(decisionId, delegationId, reason);
    }

    // --- 운영비 -------------------------------------------------------------

    /**
     * @notice 이미 기록된 판단의 설명 비용을 한 번만 차감한다 (R11.1).
     *
     * @dev 거래와 **같은 예산**을 쓴다. 운영비 예산이 따로 있었다면 그쪽으로 지출하고
     *      거래 예산을 온전히 남기는 우회가 가능했을 것이다 (R3.7, R11.6).
     *
     *      실제 지불은 여기서 하지 않는다. 이번 범위는 회계까지이고 결제 수단은
     *      PaymentAdapter 뒤에 둔다 (ADR-0004). x402 경로를 붙여도 이 함수는 그대로다.
     */
    function chargeNarrationCost(uint256 expectedDelegationId, bytes32 decisionId, uint256 amount)
        external
        onlyExecutor
    {
        if (expectedDelegationId != delegationId) revert WrongDelegation();
        if (!decisionRecorded[delegationId][decisionId]) revert DecisionNotRecorded();
        if (narrationCostRecorded[delegationId][decisionId]) revert CostAlreadyRecorded();
        _chargeOperatingCost(decisionId, amount, 1);
        narrationCostRecorded[delegationId][decisionId] = true;
    }

    /**
     * @notice 사용자가 손실 보고에 실망을 표시한다 (R10.6).
     * @dev 이 기록이 신뢰 점수를 즉시 끌어내리고 재량을 좁힌다. 회복은 실적으로만 된다 (R10.7).
     */
    function signalDisappointment(uint256 expectedDelegationId, bytes32 reportId) external onlyOwner {
        if (_delegation.expiry == 0) revert DelegationInactive();
        if (expectedDelegationId != delegationId) revert WrongDelegation();
        if (reportId == bytes32(0)) revert InvalidReport();
        if (disappointmentRecorded[delegationId][reportId]) revert DisappointmentAlreadyRecorded();
        disappointmentRecorded[delegationId][reportId] = true;
        emit Disappointed(delegationId, _delegation.characterId, reportId, block.number);
    }

    // --- 조회 ---------------------------------------------------------------

    function delegation() external view returns (Delegation memory) {
        return _delegation;
    }

    function portfolioBaseline() external view returns (PortfolioBaselineData memory) {
        return _portfolioBaseline;
    }

    function pendingDecision() external view returns (PendingDecision memory) {
        return _pendingDecision;
    }

    function decisionUsed(bytes32 decisionId) external view returns (bool) {
        return decisionRecorded[delegationId][decisionId];
    }

    function isActive() external view returns (bool) {
        return _delegation.expiry != 0 && block.timestamp <= _delegation.expiry;
    }

    function budgetRemaining() external view returns (uint256) {
        return _delegation.budget > budgetSpent ? _delegation.budget - budgetSpent : 0;
    }
}
