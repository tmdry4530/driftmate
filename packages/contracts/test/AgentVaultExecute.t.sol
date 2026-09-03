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
            characterId: CHAR,
            strategyHash: bytes32(uint256(1)),
            trustFormulaVersion: 1,
            quoteAsset: address(usdc),
            maxTradeValue: 1_000e6,
            autoThreshold: 1_000e6,
            budget: 5_000e6,
            operatingCap: 1_000e6,
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

    function _auto(bytes32 decisionId, uint256 amountIn) internal returns (uint256) {
        AgentVault.SwapOrder memory o = _order(amountIn);
        uint256 nonce = vault.stateNonce();
        vm.prank(executor);
        return vault.executeAuto(1, nonce, o, decisionId, EVIDENCE, 0);
    }

    function test_executorCanSwapWithinLimits() public {
        uint256 out = _auto(bytes32("d1"), 0.2e18);

        assertGt(out, 0);
        assertEq(usdc.balanceOf(address(vault)), out);
        assertEq(token.balanceOf(address(vault)), 99.8e18);
        assertEq(vault.budgetSpent(), 400e6);
        assertEq(vault.stateNonce(), 1);
        assertTrue(vault.decisionRecorded(1, bytes32("d1")));
        assertTrue(vault.outcomeRecorded(1, bytes32("d1")));
    }

    function test_executeEmitsSessionBoundDecisionAndOutcome() public {
        vm.recordLogs();
        _auto(bytes32("d2"), 0.1e18);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawDecided;
        bool sawExecuted;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("Decided(bytes32,uint256,bytes32,uint32,uint256,bytes)")) {
                sawDecided = true;
            }
            if (
                logs[i].topics[0]
                    == keccak256("Executed(bytes32,uint256,address,address,uint256,uint256,uint256,uint256)")
            ) {
                sawExecuted = true;
            }
        }
        assertTrue(sawDecided);
        assertTrue(sawExecuted);
    }

    function _executedValues(Vm.Log[] memory logs) private pure returns (uint256 valueIn, uint256 valueOut) {
        bytes32 signature = keccak256("Executed(bytes32,uint256,address,address,uint256,uint256,uint256,uint256)");
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] != signature) continue;
            (,,,, valueIn, valueOut) = abi.decode(logs[i].data, (address, address, uint256, uint256, uint256, uint256));
            return (valueIn, valueOut);
        }
    }

    function test_executedRecordsBothQuoteValuesForTokenInput() public {
        vm.recordLogs();
        _auto(bytes32("sell"), 0.1e18);
        (uint256 valueIn, uint256 valueOut) = _executedValues(vm.getRecordedLogs());

        assertEq(valueIn, 200e6);
        assertGt(valueOut, 0);
        assertLt(valueOut, valueIn);
    }

    function test_executedRecordsBothQuoteValuesForQuoteInput() public {
        usdc.mint(alice, 200e6);
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(address(usdc), 200e6);
        vault.setDelegation(_delegation());
        vm.stopPrank();

        uint256 expected = dex.getAmountOut(address(usdc), 200e6);
        AgentVault.SwapOrder memory o = AgentVault.SwapOrder({
            dex: address(dex),
            tokenIn: address(usdc),
            tokenOut: address(token),
            amountIn: 200e6,
            minAmountOut: (expected * 9_900) / 10_000
        });
        vm.recordLogs();
        vm.prank(executor);
        vault.executeAuto(2, 0, o, bytes32("buy"), EVIDENCE, 0);
        (uint256 valueIn, uint256 valueOut) = _executedValues(vm.getRecordedLogs());

        assertEq(valueIn, 200e6);
        assertGt(valueOut, 0);
        assertLt(valueOut, valueIn);
    }

    function test_onlyExecutorCanStartDecision() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        vm.prank(attacker);
        vm.expectRevert(AgentVault.NotExecutor.selector);
        vault.executeAuto(1, 0, o, bytes32("d3"), EVIDENCE, 0);

        vm.prank(alice);
        vm.expectRevert(AgentVault.NotExecutor.selector);
        vault.propose(1, 0, o, bytes32("d4"), EVIDENCE, 0);
    }

    function test_staleDelegationAndNonceRevert() public {
        vm.startPrank(executor);
        vm.expectRevert(AgentVault.WrongDelegation.selector);
        vault.recordNotExecuted(2, 0, bytes32("n1"), EVIDENCE, 6, 0);

        vm.expectRevert(AgentVault.WrongStateNonce.selector);
        vault.recordNotExecuted(1, 1, bytes32("n1"), EVIDENCE, 6, 0);
        vm.stopPrank();
    }

    function test_autoThresholdAndHardCapAreEnforced() public {
        AgentVault.Delegation memory d = _delegation();
        d.autoThreshold = 100e6;
        vm.prank(alice);
        vault.setDelegation(d);

        AgentVault.SwapOrder memory autoOrder = _order(0.1e18);
        vm.prank(executor);
        vm.expectRevert(AgentVault.AutoThresholdExceeded.selector);
        vault.executeAuto(2, 0, autoOrder, bytes32("auto"), EVIDENCE, 0);

        AgentVault.SwapOrder memory hardOrder = _order(1e18);
        vm.prank(executor);
        vm.expectRevert(AgentVault.ExceedsMaxTradeValue.selector);
        vault.executeAuto(2, 0, hardOrder, bytes32("hard"), EVIDENCE, 0);
    }

    function test_disallowedAssetAndDexRevert() public {
        AgentVault.SwapOrder memory assetOrder = _order(0.1e18);
        assetOrder.tokenOut = address(stranger);
        vm.prank(executor);
        vm.expectRevert(AgentVault.AssetNotAllowed.selector);
        vault.executeAuto(1, 0, assetOrder, bytes32("asset"), EVIDENCE, 0);

        AgentVault.SwapOrder memory dexOrder = _order(0.1e18);
        dexOrder.dex = address(rogueDex);
        vm.prank(executor);
        vm.expectRevert(AgentVault.DexNotAllowed.selector);
        vault.executeAuto(1, 0, dexOrder, bytes32("dex"), EVIDENCE, 0);
    }

    function test_minAmountOutMustEncodeSignedTolerance() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        o.minAmountOut = 0;
        vm.prank(executor);
        vm.expectRevert(AgentVault.SlippageTooHigh.selector);
        vault.executeAuto(1, 0, o, bytes32("slip"), EVIDENCE, 0);
    }

    function test_failedSwapCanBeFinalizedWithoutDuplicateDecision() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        o.minAmountOut = dex.getAmountOut(address(token), 0.1e18) + 1;
        vm.prank(executor);
        vm.expectRevert(MockDex.InsufficientOutput.selector);
        vault.executeAuto(1, 0, o, bytes32("fail"), EVIDENCE, 0);

        assertEq(vault.stateNonce(), 0);
        assertFalse(vault.decisionRecorded(1, bytes32("fail")));
        vm.prank(executor);
        vault.recordNotExecuted(1, 0, bytes32("fail"), EVIDENCE, 3, 0);
        assertTrue(vault.outcomeRecorded(1, bytes32("fail")));
    }

    function test_duplicateDecisionRevertsButNewSessionMayReuseId() public {
        vm.prank(executor);
        vault.recordNotExecuted(1, 0, bytes32("same"), EVIDENCE, 6, 0);
        vm.prank(executor);
        vm.expectRevert(AgentVault.DecisionAlreadyUsed.selector);
        vault.recordNotExecuted(1, 1, bytes32("same"), EVIDENCE, 6, 0);

        vm.prank(alice);
        vault.setDelegation(_delegation());
        vm.prank(executor);
        vault.recordNotExecuted(2, 0, bytes32("same"), EVIDENCE, 6, 0);
        assertTrue(vault.decisionRecorded(2, bytes32("same")));
    }

    function test_proposalPersistsExactOrderAndEvidenceHashes() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        vm.prank(executor);
        vault.propose(1, 0, o, bytes32("ask"), EVIDENCE, 0);

        AgentVault.PendingDecision memory pending = vault.pendingDecision();
        assertTrue(pending.open);
        assertEq(pending.delegationId, 1);
        assertEq(pending.proposalNonce, 0);
        assertEq(pending.decisionId, bytes32("ask"));
        assertEq(pending.evidenceHash, keccak256(EVIDENCE));
        assertEq(pending.orderHash, keccak256(abi.encode(1, 0, bytes32("ask"), o, pending.expiresAt)));
        assertEq(vault.stateNonce(), 1);
    }

    function test_pendingBlocksEveryNewDecision() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        vm.prank(executor);
        vault.propose(1, 0, o, bytes32("ask"), EVIDENCE, 0);

        vm.startPrank(executor);
        vm.expectRevert(AgentVault.PendingOpen.selector);
        vault.executeAuto(1, 1, o, bytes32("auto"), EVIDENCE, 0);
        vm.expectRevert(AgentVault.PendingOpen.selector);
        vault.propose(1, 1, o, bytes32("ask2"), EVIDENCE, 0);
        vm.expectRevert(AgentVault.PendingOpen.selector);
        vault.recordNotExecuted(1, 1, bytes32("skip"), EVIDENCE, 6, 0);
        vm.stopPrank();
    }

    function test_ownerExecutesOnlyExactPendingOrder() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        vm.prank(executor);
        vault.propose(1, 0, o, bytes32("ask"), EVIDENCE, 0);

        AgentVault.SwapOrder memory changed = o;
        changed.minAmountOut++;
        vm.prank(alice);
        vm.expectRevert(AgentVault.PendingMismatch.selector);
        vault.executeApproved(1, 1, bytes32("ask"), changed);
        changed.minAmountOut--;

        vm.prank(alice);
        uint256 out = vault.executeApproved(1, 1, bytes32("ask"), o);
        assertGt(out, 0);
        assertEq(vault.stateNonce(), 2);
        assertFalse(vault.pendingDecision().open);
        assertTrue(vault.outcomeRecorded(1, bytes32("ask")));
    }

    function test_nonOwnerCannotApproveRejectOrFinalize() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        vm.prank(executor);
        vault.propose(1, 0, o, bytes32("ask"), EVIDENCE, 0);

        vm.startPrank(attacker);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.executeApproved(1, 1, bytes32("ask"), o);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.reject(1, 1, bytes32("ask"));
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.finalizePendingFailure(1, 1, bytes32("ask"), 3);
        vm.stopPrank();
    }

    function test_ownerRejectsOnce() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        vm.prank(executor);
        vault.propose(1, 0, o, bytes32("ask"), EVIDENCE, 0);
        vm.prank(alice);
        vault.reject(1, 1, bytes32("ask"));

        assertTrue(vault.outcomeRecorded(1, bytes32("ask")));
        assertFalse(vault.pendingDecision().open);
        vm.prank(alice);
        vm.expectRevert(AgentVault.NoPending.selector);
        vault.reject(1, 2, bytes32("ask"));
    }

    function test_anyoneExpiresOnlyAfterDeadline() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        vm.prank(executor);
        vault.propose(1, 0, o, bytes32("ask"), EVIDENCE, 0);
        AgentVault.PendingDecision memory pending = vault.pendingDecision();

        vm.prank(attacker);
        vm.expectRevert(AgentVault.ApprovalNotExpired.selector);
        vault.expire(1, 1, bytes32("ask"));

        vm.warp(pending.expiresAt + 1);
        vm.prank(attacker);
        vault.expire(1, 1, bytes32("ask"));
        assertTrue(vault.outcomeRecorded(1, bytes32("ask")));
    }

    function test_expiredApprovalNeedsOwnerFailureFinalization() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        vm.prank(executor);
        vault.propose(1, 0, o, bytes32("ask"), EVIDENCE, 0);
        AgentVault.PendingDecision memory pending = vault.pendingDecision();
        vm.warp(pending.expiresAt + 1);

        vm.prank(alice);
        vm.expectRevert(AgentVault.ApprovalExpired.selector);
        vault.executeApproved(1, 1, bytes32("ask"), o);
        vm.prank(alice);
        vault.finalizePendingFailure(1, 1, bytes32("ask"), 3);
        assertTrue(vault.outcomeRecorded(1, bytes32("ask")));
    }

    function test_failedApprovedSwapKeepsPendingForOwnerFinalization() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        o.minAmountOut = dex.getAmountOut(address(token), 0.1e18) + 1;
        vm.prank(executor);
        vault.propose(1, 0, o, bytes32("fail"), EVIDENCE, 0);

        vm.prank(alice);
        vm.expectRevert(MockDex.InsufficientOutput.selector);
        vault.executeApproved(1, 1, bytes32("fail"), o);
        assertTrue(vault.pendingDecision().open);
        assertTrue(vault.decisionRecorded(1, bytes32("fail")));
        assertFalse(vault.outcomeRecorded(1, bytes32("fail")));

        vm.prank(alice);
        vault.finalizePendingFailure(1, 1, bytes32("fail"), 3);
        assertFalse(vault.pendingDecision().open);
        assertTrue(vault.outcomeRecorded(1, bytes32("fail")));
    }

    function test_revokeAndDepositFinalizePendingOnce() public {
        AgentVault.SwapOrder memory o = _order(0.1e18);
        vm.prank(executor);
        vault.propose(1, 0, o, bytes32("revoke"), EVIDENCE, 0);
        vm.prank(alice);
        vault.revoke();
        assertTrue(vault.outcomeRecorded(1, bytes32("revoke")));
        assertFalse(vault.pendingDecision().open);

        vm.prank(alice);
        vault.setDelegation(_delegation());
        o = _order(0.1e18);
        vm.prank(executor);
        vault.propose(2, 0, o, bytes32("deposit"), EVIDENCE, 0);
        token.mint(alice, 1e18);
        vm.prank(alice);
        vault.deposit(address(token), 1e18);
        assertTrue(vault.outcomeRecorded(2, bytes32("deposit")));
        assertFalse(vault.pendingDecision().open);
    }

    function test_budgetIsConsumedAcrossAutoTrades() public {
        _auto(bytes32("b1"), 0.5e18);
        uint256 afterFirst = vault.budgetSpent();
        _auto(bytes32("b2"), 0.5e18);
        uint256 afterSecond = vault.budgetSpent();

        assertEq(afterFirst, 1_000e6);
        assertLt(afterSecond - afterFirst, 1_000e6);
        assertEq(vault.budgetRemaining(), 5_000e6 - afterSecond);
    }
}
