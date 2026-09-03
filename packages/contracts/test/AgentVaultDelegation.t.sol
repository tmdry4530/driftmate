// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {MockERC3009} from "../src/MockERC3009.sol";
import {MockDex} from "../src/MockDex.sol";

contract AgentVaultDelegationTest is Test {
    AgentVault internal vault;
    MockERC3009 internal token;
    MockERC3009 internal usdc;
    MockDex internal dex;

    address internal alice = address(0xA11CE);
    address internal executor = address(0xE0E0);
    address internal attacker = address(0xBAD);
    bytes32 internal constant CHAR = bytes32("timid");
    bytes32 internal constant STRATEGY_HASH = 0x4acec38fbb39d62ac2bb9c262fcbf617a3cb5235fbd17c73f35b70870ba8ac47;

    function setUp() public {
        vm.warp(1_000_000);
        token = new MockERC3009("Token A", "TKA", 18);
        usdc = new MockERC3009("Mock USD", "mUSD", 6);
        vault = new AgentVault(alice);

        token.mint(address(this), 1_000e18);
        usdc.mint(address(this), 2_000_000e6);
        dex = new MockDex(address(token), address(usdc));
        token.approve(address(dex), type(uint256).max);
        usdc.approve(address(dex), type(uint256).max);
        dex.addLiquidity(1_000e18, 2_000_000e6);

        token.mint(alice, 100e18);
        usdc.mint(address(vault), 1e6);
        vm.prank(alice);
        token.approve(address(vault), type(uint256).max);
    }

    function _delegation() internal view returns (AgentVault.Delegation memory d) {
        address[] memory assets = new address[](2);
        assets[0] = address(token);
        assets[1] = address(usdc);
        address[] memory dexes = new address[](1);
        dexes[0] = address(dex);

        d = AgentVault.Delegation({
            executor: executor,
            characterId: CHAR,
            strategyHash: STRATEGY_HASH,
            trustFormulaVersion: 1,
            quoteAsset: address(usdc),
            maxTradeValue: 1_000e6,
            autoThreshold: 100e6,
            budget: 10_000e6,
            operatingCap: 2_000e6,
            expiry: uint64(block.timestamp + 30 days),
            approvalTtlSeconds: 1 hours,
            slippageToleranceBps: 100,
            targetAsset: address(token),
            targetAssetBps: 6_000,
            allowedAssets: assets,
            allowedDexes: dexes
        });
    }

    // --- 예치·인출 -----------------------------------------------------------

    function test_ownerCanDepositAndWithdraw() public {
        vm.startPrank(alice);
        vault.deposit(address(token), 10e18);
        assertEq(token.balanceOf(address(vault)), 10e18);

        vault.withdraw(address(token), 4e18);
        assertEq(token.balanceOf(alice), 94e18);
        vm.stopPrank();
    }

    function test_nonOwnerCannotWithdraw() public {
        vm.prank(alice);
        vault.deposit(address(token), 10e18);

        vm.prank(attacker);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.withdraw(address(token), 1e18);
    }

    /// 비수탁의 핵심: 실행자에게도 인출 경로가 없어야 한다 (R1.2).
    function test_executorCannotWithdraw() public {
        vm.startPrank(alice);
        vault.deposit(address(token), 10e18);
        vault.setDelegation(_delegation());
        vm.stopPrank();

        vm.prank(executor);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.withdraw(address(token), 1e18);

        assertEq(token.balanceOf(address(vault)), 10e18);
    }

    /// 인출 수신자를 지정할 방법이 없다는 것 자체가 방어다.
    function test_withdrawAlwaysGoesToOwner() public {
        vm.startPrank(alice);
        vault.deposit(address(token), 10e18);
        uint256 before = token.balanceOf(alice);
        vault.withdraw(address(token), 3e18);
        vm.stopPrank();

        assertEq(token.balanceOf(alice) - before, 3e18);
        assertEq(token.balanceOf(attacker), 0);
    }

    // --- 위임 설정 -----------------------------------------------------------

    function test_setDelegationStoresLimits() public {
        vm.prank(alice);
        vault.setDelegation(_delegation());

        AgentVault.Delegation memory d = vault.delegation();
        assertEq(d.executor, executor);
        assertEq(d.characterId, CHAR);
        assertEq(d.strategyHash, STRATEGY_HASH);
        assertEq(d.trustFormulaVersion, 1);
        assertEq(d.maxTradeValue, 1_000e6);
        assertEq(d.autoThreshold, 100e6);
        assertEq(d.budget, 10_000e6);
        assertEq(d.operatingCap, 2_000e6);
        assertEq(d.approvalTtlSeconds, 1 hours);
        assertEq(d.slippageToleranceBps, 100);
        assertEq(d.targetAsset, address(token));
        assertEq(d.targetAssetBps, 6_000);
        assertTrue(vault.isAllowedAsset(address(token)));
        assertTrue(vault.isAllowedAsset(address(usdc)));
        assertTrue(vault.isAllowedDex(address(dex)));
        assertTrue(vault.isActive());
    }

    function test_strategyHashMatchesTypescriptVector() public pure {
        assertEq(keccak256(abi.encode(CHAR, uint16(300), uint8(0), uint256(1_000_000))), STRATEGY_HASH);
    }

    function test_setDelegationStoresSessionAndBaseline() public {
        AgentVault.Delegation memory input = _delegation();
        vm.recordLogs();
        vm.prank(alice);
        vault.setDelegation(input);

        assertEq(vault.delegationId(), 1);
        assertEq(vault.stateNonce(), 0);
        assertEq(vault.configHash(), keccak256(abi.encode(input)));

        AgentVault.PortfolioBaselineData memory baseline = vault.portfolioBaseline();
        assertEq(baseline.delegationId, 1);
        assertEq(baseline.characterId, CHAR);
        assertEq(baseline.quoteAsset, address(usdc));
        assertEq(baseline.pricingDex, address(dex));
        assertEq(baseline.targetAsset, address(token));
        assertEq(baseline.targetBalance, 0);
        assertEq(baseline.quoteBalance, 1e6);
        assertEq(baseline.targetPriceE18, 2_000_000_000);
        assertEq(baseline.valueQuote, 1e6);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawBaseline;
        for (uint256 i = 0; i < logs.length; i++) {
            if (
                logs[i].topics[0]
                    == keccak256(
                        "PortfolioBaseline(uint256,bytes32,address,address,address,uint256,uint256,uint256,uint256,uint256)"
                    )
            ) sawBaseline = true;
        }
        assertTrue(sawBaseline);
    }

    function test_redelegationStartsNewSession() public {
        vm.startPrank(alice);
        vault.setDelegation(_delegation());
        vault.revoke();
        assertEq(vault.stateNonce(), 1);
        vault.setDelegation(_delegation());
        vm.stopPrank();

        assertEq(vault.delegationId(), 2);
        assertEq(vault.stateNonce(), 0);
        assertEq(vault.budgetSpent(), 0);
        assertEq(vault.operatingSpent(), 0);
    }

    function test_rejectsInvalidIdentityAndLimits() public {
        AgentVault.Delegation memory d = _delegation();
        d.characterId = bytes32(0);
        vm.prank(alice);
        vm.expectRevert(AgentVault.InvalidCharacter.selector);
        vault.setDelegation(d);

        d = _delegation();
        d.strategyHash = bytes32(0);
        vm.prank(alice);
        vm.expectRevert(AgentVault.InvalidStrategyHash.selector);
        vault.setDelegation(d);

        d = _delegation();
        d.trustFormulaVersion = 0;
        vm.prank(alice);
        vm.expectRevert(AgentVault.InvalidTrustFormulaVersion.selector);
        vault.setDelegation(d);

        d = _delegation();
        d.autoThreshold = d.maxTradeValue + 1;
        vm.prank(alice);
        vm.expectRevert(AgentVault.InvalidLimits.selector);
        vault.setDelegation(d);

        d = _delegation();
        d.operatingCap = d.budget + 1;
        vm.prank(alice);
        vm.expectRevert(AgentVault.InvalidLimits.selector);
        vault.setDelegation(d);

        d = _delegation();
        d.targetAssetBps = 10_001;
        vm.prank(alice);
        vm.expectRevert(AgentVault.InvalidLimits.selector);
        vault.setDelegation(d);

        d = _delegation();
        d.slippageToleranceBps = 10_001;
        vm.prank(alice);
        vm.expectRevert(AgentVault.InvalidLimits.selector);
        vault.setDelegation(d);
    }

    function test_rejectsInvalidExpiryAndApprovalTtl() public {
        AgentVault.Delegation memory d = _delegation();
        d.expiry = uint64(block.timestamp);
        vm.prank(alice);
        vm.expectRevert(AgentVault.InvalidExpiry.selector);
        vault.setDelegation(d);

        d = _delegation();
        d.approvalTtlSeconds = 0;
        vm.prank(alice);
        vm.expectRevert(AgentVault.InvalidExpiry.selector);
        vault.setDelegation(d);
    }

    function test_rejectsInvalidAssetAndDexPairs() public {
        AgentVault.Delegation memory d = _delegation();
        d.allowedAssets[1] = address(token);
        vm.prank(alice);
        vm.expectRevert(AgentVault.InvalidAssetPair.selector);
        vault.setDelegation(d);

        MockERC3009 other = new MockERC3009("Other", "OTH", 18);
        MockDex wrongDex = new MockDex(address(other), address(usdc));
        d = _delegation();
        d.allowedDexes[0] = address(wrongDex);
        vm.prank(alice);
        vm.expectRevert(AgentVault.InvalidDexPair.selector);
        vault.setDelegation(d);
    }

    function test_rejectsEmptyPortfolio() public {
        AgentVault emptyVault = new AgentVault(alice);
        vm.prank(alice);
        vm.expectRevert(AgentVault.EmptyPortfolio.selector);
        emptyVault.setDelegation(_delegation());
    }

    function test_nonOwnerCannotSetDelegation() public {
        vm.prank(attacker);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.setDelegation(_delegation());
    }

    function test_delegationCannotHaveZeroExecutor() public {
        AgentVault.Delegation memory d = _delegation();
        d.executor = address(0);

        vm.prank(alice);
        vm.expectRevert(AgentVault.ZeroExecutor.selector);
        vault.setDelegation(d);
    }

    /// 캐릭터를 바꾸면 기존 위임이 새 설정으로 대체된다 (R2.5).
    function test_resetDelegationClearsPreviousAllowList() public {
        MockERC3009 other = new MockERC3009("Token B", "TKB", 18);
        other.mint(address(this), 1_000e18);
        usdc.mint(address(this), 2_000_000e6);
        MockDex nextDex = new MockDex(address(other), address(usdc));
        other.approve(address(nextDex), type(uint256).max);
        usdc.approve(address(nextDex), type(uint256).max);
        nextDex.addLiquidity(1_000e18, 2_000_000e6);

        vm.startPrank(alice);
        vault.setDelegation(_delegation());

        AgentVault.Delegation memory next = _delegation();
        address[] memory nextAssets = new address[](2);
        nextAssets[0] = address(other);
        nextAssets[1] = address(usdc);
        address[] memory nextDexes = new address[](1);
        nextDexes[0] = address(nextDex);
        next.targetAsset = address(other);
        next.allowedAssets = nextAssets;
        next.allowedDexes = nextDexes;
        vault.setDelegation(next);
        vm.stopPrank();

        assertFalse(vault.isAllowedAsset(address(token)));
        assertTrue(vault.isAllowedAsset(address(other)));
        assertTrue(vault.isAllowedAsset(address(usdc)));
        assertFalse(vault.isAllowedDex(address(dex)));
        assertTrue(vault.isAllowedDex(address(nextDex)));
    }

    function test_resetDelegationResetsSpentBudget() public {
        vm.startPrank(alice);
        vault.setDelegation(_delegation());
        vault.setDelegation(_delegation());
        vm.stopPrank();

        assertEq(vault.budgetSpent(), 0);
        assertEq(vault.budgetRemaining(), 10_000e6);
    }

    // --- 철회·만료 -----------------------------------------------------------

    function test_depositAndWithdrawEndActiveDelegation() public {
        vm.startPrank(alice);
        vault.setDelegation(_delegation());
        vault.deposit(address(token), 1e18);
        assertFalse(vault.isActive());

        vault.setDelegation(_delegation());
        vault.withdraw(address(token), 1e18);
        assertFalse(vault.isActive());
        vm.stopPrank();
    }

    function test_failedTokenReturnRevertsRevocation() public {
        FalseERC20 falseToken = new FalseERC20();
        falseToken.mint(address(vault), 1);
        vm.prank(alice);
        vault.setDelegation(_delegation());

        vm.prank(alice);
        vm.expectRevert(AgentVault.TokenTransferFailed.selector);
        vault.withdraw(address(falseToken), 1);
        assertTrue(vault.isActive());

        vm.prank(alice);
        vm.expectRevert(AgentVault.TokenTransferFailed.selector);
        vault.deposit(address(falseToken), 1);
        assertTrue(vault.isActive());
    }

    function test_withdrawDoesNotReadBrokenPrice() public {
        TogglePriceDex priceDex = new TogglePriceDex(address(token), address(usdc), 2_000_000_000);
        AgentVault.Delegation memory d = _delegation();
        d.allowedDexes[0] = address(priceDex);

        vm.startPrank(alice);
        vault.deposit(address(token), 2e18);
        vault.setDelegation(d);
        priceDex.setBroken(true);
        vault.withdraw(address(token), 1e18);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 99e18);
        assertFalse(vault.isActive());
    }

    function test_revokeStopsDelegationImmediately() public {
        vm.startPrank(alice);
        vault.setDelegation(_delegation());
        assertTrue(vault.isActive());

        vault.revoke();
        vm.stopPrank();

        assertFalse(vault.isActive());
        assertFalse(vault.isAllowedAsset(address(token)));
        assertEq(vault.delegation().executor, address(0));
    }

    function test_nonOwnerCannotRevoke() public {
        vm.prank(alice);
        vault.setDelegation(_delegation());

        vm.prank(attacker);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.revoke();
    }

    function test_delegationExpires() public {
        vm.prank(alice);
        vault.setDelegation(_delegation());

        vm.warp(block.timestamp + 31 days);
        assertFalse(vault.isActive());
    }

    function test_ownerCanStillWithdrawAfterRevoke() public {
        vm.startPrank(alice);
        vault.deposit(address(token), 10e18);
        vault.setDelegation(_delegation());
        vault.revoke();

        // 위임을 끊어도 자기 자산은 언제나 꺼낼 수 있어야 한다.
        vault.withdraw(address(token), 10e18);
        vm.stopPrank();

        assertEq(token.balanceOf(address(vault)), 0);
    }
}

contract FalseERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address, uint256) external pure returns (bool) {
        return false;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

contract TogglePriceDex {
    address public immutable token0;
    address public immutable token1;
    uint256 private immutable price;
    bool private broken;

    constructor(address a, address b, uint256 p) {
        token0 = a;
        token1 = b;
        price = p;
    }

    function setBroken(bool value) external {
        broken = value;
    }

    function getSpotPriceE18(address) external view returns (uint256) {
        require(!broken, "price unavailable");
        return price;
    }
}
