// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {MockERC3009} from "../src/MockERC3009.sol";
import {MockDex} from "../src/MockDex.sol";

contract AgentVaultBudgetTest is Test {
    AgentVault internal vault;
    MockERC3009 internal token;
    MockERC3009 internal usdc;
    MockDex internal dex;

    address internal alice = address(0xA11CE);
    address internal executor = address(0xE0E0);
    address internal attacker = address(0xBAD);

    uint256 internal constant BUDGET = 5_000e6;
    bytes32 internal constant CHAR = bytes32("timid");
    bytes internal EVIDENCE = hex"c0ffee";

    function setUp() public {
        vm.warp(1_000_000);
        token = new MockERC3009("Token A", "TKA", 18);
        usdc = new MockERC3009("Mock USD", "mUSD", 6);

        token.mint(address(this), 100_000e18);
        usdc.mint(address(this), 200_000_000e6);
        dex = new MockDex(address(token), address(usdc));
        token.approve(address(dex), type(uint256).max);
        usdc.approve(address(dex), type(uint256).max);
        dex.addLiquidity(100_000e18, 200_000_000e6);

        vault = new AgentVault(alice);
        token.mint(alice, 1_000e18);
        vm.startPrank(alice);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(address(token), 1_000e18);
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
            characterId: CHAR,
            strategyHash: bytes32(uint256(1)),
            trustFormulaVersion: 1,
            quoteAsset: address(usdc),
            maxTradeValue: 1_000e6,
            autoThreshold: 1_000e6,
            budget: BUDGET,
            operatingCap: BUDGET,
            expiry: uint64(block.timestamp + 30 days),
            approvalTtlSeconds: 1 hours,
            slippageToleranceBps: 100,
            targetAsset: address(token),
            targetAssetBps: 6_000,
            allowedAssets: assets,
            allowedDexes: dexes
        });
    }

    function _order(uint256 amountIn) internal view returns (AgentVault.SwapOrder memory) {
        uint256 expected = dex.getAmountOut(address(token), amountIn);
        return AgentVault.SwapOrder({
            dex: address(dex),
            tokenIn: address(token),
            tokenOut: address(usdc),
            amountIn: amountIn,
            minAmountOut: (expected * 9_900) / 10_000
        });
    }

    function _recordPrice(bytes32 decisionId, uint256 amount) internal {
        uint256 nonce = vault.stateNonce();
        vm.prank(executor);
        vault.recordNotExecuted(1, nonce, decisionId, EVIDENCE, 6, amount);
    }

    function _auto(bytes32 decisionId, uint256 amountIn, uint256 priceCost) internal {
        uint256 nonce = vault.stateNonce();
        AgentVault.SwapOrder memory o = _order(amountIn);
        vm.prank(executor);
        vault.executeAuto(1, nonce, o, decisionId, EVIDENCE, priceCost);
    }

    function test_priceCostAndTradeShareOneBudgetAtomically() public {
        _recordPrice(bytes32("c1"), 100e6);
        _auto(bytes32("t1"), 0.5e18, 50e6);

        assertApproxEqRel(vault.budgetSpent(), 1_150e6, 0.001e18);
        assertEq(vault.operatingSpent(), 150e6);
    }

    function test_priceCostCannotLeaveOrphanWhenTradeFails() public {
        AgentVault.SwapOrder memory o = _order(0.5e18);
        o.minAmountOut = dex.getAmountOut(address(token), 0.5e18) + 1;
        vm.prank(executor);
        vm.expectRevert(MockDex.InsufficientOutput.selector);
        vault.executeAuto(1, 0, o, bytes32("fail"), EVIDENCE, 100e6);

        assertEq(vault.budgetSpent(), 0);
        assertEq(vault.operatingSpent(), 0);
        assertFalse(vault.decisionRecorded(1, bytes32("fail")));
    }

    function test_costReducesTradeCapacity() public {
        _recordPrice(bytes32("cost"), 4_500e6);
        AgentVault.SwapOrder memory o = _order(0.5e18);
        vm.prank(executor);
        vm.expectRevert(AgentVault.BudgetExhausted.selector);
        vault.executeAuto(1, 1, o, bytes32("trade"), EVIDENCE, 0);
        assertEq(vault.budgetSpent(), 4_500e6);
    }

    function test_tradeReducesCostCapacity() public {
        _auto(bytes32("trade"), 0.5e18, 0);
        vm.prank(executor);
        vm.expectRevert(AgentVault.BudgetExhausted.selector);
        vault.recordNotExecuted(1, 1, bytes32("cost"), EVIDENCE, 6, 4_100e6);
        assertEq(vault.operatingSpent(), 0);
    }

    function test_operatingCapIsEnforcedSeparately() public {
        AgentVault.Delegation memory d = _delegation();
        d.operatingCap = 100e6;
        vm.prank(alice);
        vault.setDelegation(d);

        vm.prank(executor);
        vm.expectRevert(AgentVault.OperatingBudgetExhausted.selector);
        vault.recordNotExecuted(2, 0, bytes32("cost"), EVIDENCE, 6, 100e6 + 1);
        assertEq(vault.budgetSpent(), 0);
        assertEq(vault.operatingSpent(), 0);
    }

    function test_costChargeEmitsSessionBoundEvent() public {
        vm.recordLogs();
        _recordPrice(bytes32("cost"), 123e6);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool saw;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("CostCharged(bytes32,uint256,uint256,uint8)")) saw = true;
        }
        assertTrue(saw);
    }

    function test_narrationCostRequiresDecisionAndIsChargedOnce() public {
        vm.prank(executor);
        vm.expectRevert(AgentVault.DecisionNotRecorded.selector);
        vault.chargeNarrationCost(1, bytes32("d1"), 10e6);

        _recordPrice(bytes32("d1"), 20e6);
        vm.prank(executor);
        vault.chargeNarrationCost(1, bytes32("d1"), 10e6);
        assertEq(vault.operatingSpent(), 30e6);

        vm.prank(executor);
        vm.expectRevert(AgentVault.CostAlreadyRecorded.selector);
        vault.chargeNarrationCost(1, bytes32("d1"), 10e6);
    }

    function test_nonExecutorCannotChargeNarration() public {
        _recordPrice(bytes32("d1"), 0);
        vm.prank(attacker);
        vm.expectRevert(AgentVault.NotExecutor.selector);
        vault.chargeNarrationCost(1, bytes32("d1"), 10e6);
    }

    function testFuzz_costNeverExceedsEitherBudget(uint96 a, uint96 b, uint96 c) public {
        uint96[3] memory amounts = [a, b, c];
        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 nonce = vault.stateNonce();
            vm.prank(executor);
            try vault.recordNotExecuted(1, nonce, bytes32(i + 100), EVIDENCE, 6, amounts[i]) {} catch {}
            assertLe(vault.budgetSpent(), BUDGET);
            assertLe(vault.operatingSpent(), BUDGET);
        }
    }

    function testFuzz_mixedSpendingNeverExceedsBudget(uint96 cost, uint64 tradeAmount) public {
        uint256 amountIn = bound(uint256(tradeAmount), 1e12, 0.5e18);
        _recordPriceOrIgnore(bytes32("cost"), cost);

        uint256 nonce = vault.stateNonce();
        AgentVault.SwapOrder memory o = _order(amountIn);
        vm.prank(executor);
        try vault.executeAuto(1, nonce, o, bytes32("trade"), EVIDENCE, 0) {} catch {}
        assertLe(vault.budgetSpent(), BUDGET);
        assertLe(vault.operatingSpent(), BUDGET);
    }

    function _recordPriceOrIgnore(bytes32 decisionId, uint256 amount) private {
        uint256 nonce = vault.stateNonce();
        vm.prank(executor);
        try vault.recordNotExecuted(1, nonce, decisionId, EVIDENCE, 6, amount) {} catch {}
    }

    function test_disappointmentIsSessionBoundAndUnique() public {
        bytes32 reportId = keccak256("loss-report");
        vm.prank(alice);
        vault.signalDisappointment(1, reportId);
        assertTrue(vault.disappointmentRecorded(1, reportId));

        vm.prank(alice);
        vm.expectRevert(AgentVault.DisappointmentAlreadyRecorded.selector);
        vault.signalDisappointment(1, reportId);

        vm.prank(alice);
        vm.expectRevert(AgentVault.WrongDelegation.selector);
        vault.signalDisappointment(2, keccak256("other"));
    }

    function test_onlyOwnerCanSignalDisappointment() public {
        vm.prank(executor);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.signalDisappointment(1, keccak256("loss"));
    }
}
