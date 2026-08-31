// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {MockERC3009} from "../src/MockERC3009.sol";
import {MockDex} from "../src/MockDex.sol";

contract AgentVaultExecuteTest is Test {
    AgentVault internal vault;
    MockERC3009 internal token;
    MockERC3009 internal usdc;
    MockERC3009 internal stranger;
    MockDex internal dex;
    MockDex internal rogueDex;

    address internal alice = address(0xA11CE);
    address internal executor = address(0xE0E0);
    address internal attacker = address(0xBAD);

    bytes32 internal constant CHAR = bytes32("timid");
    bytes internal EVIDENCE = hex"c0ffee";

    function setUp() public {
        vm.warp(1_000_000);
        token = new MockERC3009("Token A", "TKA", 18);
        usdc = new MockERC3009("Mock USD", "mUSD", 6);
        stranger = new MockERC3009("Stranger", "STR", 18);

        // TOKEN 1개 = 2000 USDC
        token.mint(address(this), 10_000e18);
        usdc.mint(address(this), 20_000_000e6);
        dex = new MockDex(address(token), address(usdc));
        token.approve(address(dex), type(uint256).max);
        usdc.approve(address(dex), type(uint256).max);
        dex.addLiquidity(10_000e18, 20_000_000e6);

        rogueDex = new MockDex(address(token), address(usdc));

        vault = new AgentVault(alice);
        token.mint(alice, 100e18);
        vm.startPrank(alice);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(address(token), 100e18);
        vault.setDelegation(_delegation());
        vm.stopPrank();
    }

    function _delegation() internal view returns (AgentVault.Delegation memory d) {
        address[] memory assets = new address[](2);
        assets[0] = address(token);
        assets[1] = address(usdc);
        address[] memory dexes = new address[](1);
        dexes[0] = address(dex);

        d = AgentVault.Delegation({
            executor: executor,
            quoteAsset: address(usdc),
            maxTradeValue: 1_000e6, // $1000
            autoThreshold: 100e6,
            budget: 5_000e6, // $5000
            expiry: uint64(block.timestamp + 30 days),
            allowedAssets: assets,
            allowedDexes: dexes
        });
    }

    function _order(uint256 amountIn, uint256 minOut) internal view returns (AgentVault.SwapOrder memory) {
        return AgentVault.SwapOrder({
            dex: address(dex),
            tokenIn: address(token),
            tokenOut: address(usdc),
            amountIn: amountIn,
            minAmountOut: minOut
        });
    }

    // --- 정상 실행 -----------------------------------------------------------

    function test_executorCanSwapWithinLimits() public {
        // 0.2 TOKEN = $400 < 하드캡 $1000
        vm.prank(executor);
        uint256 out = vault.execute(_order(0.2e18, 0), bytes32("d1"), CHAR, EVIDENCE);

        assertGt(out, 0);
        assertEq(usdc.balanceOf(address(vault)), out);
        assertEq(token.balanceOf(address(vault)), 99.8e18);
        assertEq(vault.budgetSpent(), 400e6);
    }

    function test_executeEmitsDecidedAndExecuted() public {
        vm.recordLogs();
        vm.prank(executor);
        vault.execute(_order(0.1e18, 0), bytes32("d2"), CHAR, EVIDENCE);

        // 판단과 실행이 한 묶음으로 남는다 (R7.1).
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawDecided;
        bool sawExecuted;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("Decided(bytes32,bytes32,uint256,bytes)")) sawDecided = true;
            if (logs[i].topics[0] == keccak256("Executed(bytes32,address,address,uint256,uint256,uint256)")) {
                sawExecuted = true;
            }
        }
        assertTrue(sawDecided);
        assertTrue(sawExecuted);
    }

    // --- 권한 -------------------------------------------------------------

    function test_nonExecutorCannotExecute() public {
        vm.prank(attacker);
        vm.expectRevert(AgentVault.NotExecutor.selector);
        vault.execute(_order(0.1e18, 0), bytes32("d3"), CHAR, EVIDENCE);
    }

    function test_ownerIsNotExecutor() public {
        vm.prank(alice);
        vm.expectRevert(AgentVault.NotExecutor.selector);
        vault.execute(_order(0.1e18, 0), bytes32("d4"), CHAR, EVIDENCE);
    }

    function test_executeBlockedAfterRevoke() public {
        vm.prank(alice);
        vault.revoke();

        vm.prank(executor);
        vm.expectRevert(AgentVault.NotExecutor.selector);
        vault.execute(_order(0.1e18, 0), bytes32("d5"), CHAR, EVIDENCE);
    }

    function test_executeBlockedAfterExpiry() public {
        vm.warp(block.timestamp + 31 days);

        vm.prank(executor);
        vm.expectRevert(AgentVault.DelegationExpired.selector);
        vault.execute(_order(0.1e18, 0), bytes32("d6"), CHAR, EVIDENCE);
    }

    // --- 한도 강제 -----------------------------------------------------------

    function test_exceedingHardCapReverts() public {
        // 1 TOKEN = $2000 > 하드캡 $1000
        vm.prank(executor);
        vm.expectRevert(AgentVault.ExceedsMaxTradeValue.selector);
        vault.execute(_order(1e18, 0), bytes32("d7"), CHAR, EVIDENCE);
    }

    function test_disallowedAssetReverts() public {
        AgentVault.SwapOrder memory o = _order(0.1e18, 0);
        o.tokenOut = address(stranger);

        vm.prank(executor);
        vm.expectRevert(AgentVault.AssetNotAllowed.selector);
        vault.execute(o, bytes32("d8"), CHAR, EVIDENCE);
    }

    function test_disallowedDexReverts() public {
        AgentVault.SwapOrder memory o = _order(0.1e18, 0);
        o.dex = address(rogueDex);

        vm.prank(executor);
        vm.expectRevert(AgentVault.DexNotAllowed.selector);
        vault.execute(o, bytes32("d9"), CHAR, EVIDENCE);
    }

    function test_duplicateDecisionReverts() public {
        vm.startPrank(executor);
        vault.execute(_order(0.1e18, 0), bytes32("dup"), CHAR, EVIDENCE);

        vm.expectRevert(AgentVault.DecisionAlreadyUsed.selector);
        vault.execute(_order(0.1e18, 0), bytes32("dup"), CHAR, EVIDENCE);
        vm.stopPrank();
    }

    function test_slippageBeyondToleranceReverts() public {
        uint256 expected = dex.getAmountOut(address(token), 0.1e18);

        vm.prank(executor);
        vm.expectRevert(MockDex.InsufficientOutput.selector);
        vault.execute(_order(0.1e18, expected + 1), bytes32("d10"), CHAR, EVIDENCE);
    }

    function test_budgetIsConsumedAcrossTrades() public {
        vm.startPrank(executor);
        vault.execute(_order(0.5e18, 0), bytes32("b1"), CHAR, EVIDENCE);
        uint256 afterFirst = vault.budgetSpent();
        vault.execute(_order(0.5e18, 0), bytes32("b2"), CHAR, EVIDENCE);
        uint256 afterSecond = vault.budgetSpent();
        vm.stopPrank();

        assertEq(afterFirst, 1_000e6); // 0.5 TOKEN × $2000

        // 첫 스왑이 풀 가격을 움직였으므로 같은 수량이라도 두 번째 가치는 약간 작다.
        // 볼트가 신고된 값이 아니라 그때그때의 스팟을 읽는다는 증거다.
        uint256 second = afterSecond - afterFirst;
        assertLt(second, 1_000e6);
        assertApproxEqRel(second, 1_000e6, 0.001e18); // 0.1% 이내
        assertEq(vault.budgetRemaining(), 5_000e6 - afterSecond);
    }

    function test_budgetExhaustionReverts() public {
        vm.startPrank(executor);
        for (uint256 i = 0; i < 5; i++) {
            vault.execute(_order(0.5e18, 0), bytes32(i + 1), CHAR, EVIDENCE); // $1000 × 5 = 예산 전액
        }
        vm.expectRevert(AgentVault.BudgetExhausted.selector);
        vault.execute(_order(0.1e18, 0), bytes32("over"), CHAR, EVIDENCE);
        vm.stopPrank();
    }

    /// 실행자가 가치를 낮게 신고해 한도를 우회할 수 없어야 한다.
    function test_valueIsComputedByVaultNotCaller() public {
        // SwapOrder에는 가치 필드가 없다. 볼트가 DEX에서 직접 읽어 계산한다.
        vm.prank(executor);
        vault.execute(_order(0.25e18, 0), bytes32("v1"), CHAR, EVIDENCE);

        // 0.25 TOKEN × $2000 = $500 이 그대로 예산에서 빠진다.
        assertEq(vault.budgetSpent(), 500e6);
    }

    // --- 미실행 기록 ---------------------------------------------------------

    function test_notExecutedIsRecorded() public {
        vm.recordLogs();
        vm.prank(executor);
        vault.recordNotExecuted(bytes32("n1"), CHAR, EVIDENCE, 0);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawNotExecuted;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("NotExecuted(bytes32,uint8)")) sawNotExecuted = true;
        }
        assertTrue(sawNotExecuted);
        assertTrue(vault.decisionUsed(bytes32("n1")));
    }

    function test_notExecutedDecisionCannotBeExecutedLater() public {
        vm.startPrank(executor);
        vault.recordNotExecuted(bytes32("n2"), CHAR, EVIDENCE, 0);

        vm.expectRevert(AgentVault.DecisionAlreadyUsed.selector);
        vault.execute(_order(0.1e18, 0), bytes32("n2"), CHAR, EVIDENCE);
        vm.stopPrank();
    }

    function test_nonExecutorCannotRecordNotExecuted() public {
        vm.prank(attacker);
        vm.expectRevert(AgentVault.NotExecutor.selector);
        vault.recordNotExecuted(bytes32("n3"), CHAR, EVIDENCE, 0);
    }
}
