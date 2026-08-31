// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {MockERC3009} from "../src/MockERC3009.sol";

contract AgentVaultDelegationTest is Test {
    AgentVault internal vault;
    MockERC3009 internal token;
    MockERC3009 internal usdc;

    address internal alice = address(0xA11CE);
    address internal executor = address(0xE0E0);
    address internal attacker = address(0xBAD);
    address internal dex = address(0xDE0);

    function setUp() public {
        vm.warp(1_000_000);
        token = new MockERC3009("Token A", "TKA", 18);
        usdc = new MockERC3009("Mock USD", "mUSD", 6);
        vault = new AgentVault(alice);

        token.mint(alice, 100e18);
        vm.prank(alice);
        token.approve(address(vault), type(uint256).max);
    }

    function _delegation() internal view returns (AgentVault.Delegation memory d) {
        address[] memory assets = new address[](2);
        assets[0] = address(token);
        assets[1] = address(usdc);
        address[] memory dexes = new address[](1);
        dexes[0] = dex;

        d = AgentVault.Delegation({
            executor: executor,
            quoteAsset: address(usdc),
            maxTradeValue: 1_000e6,
            autoThreshold: 100e6,
            budget: 10_000e6,
            expiry: uint64(block.timestamp + 30 days),
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
        assertEq(d.maxTradeValue, 1_000e6);
        assertEq(d.autoThreshold, 100e6);
        assertEq(d.budget, 10_000e6);
        assertTrue(vault.isAllowedAsset(address(token)));
        assertTrue(vault.isAllowedAsset(address(usdc)));
        assertTrue(vault.isAllowedDex(dex));
        assertTrue(vault.isActive());
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
        vm.startPrank(alice);
        vault.setDelegation(_delegation());

        AgentVault.Delegation memory next = _delegation();
        address[] memory onlyUsdc = new address[](1);
        onlyUsdc[0] = address(usdc);
        next.allowedAssets = onlyUsdc;
        vault.setDelegation(next);
        vm.stopPrank();

        assertFalse(vault.isAllowedAsset(address(token)));
        assertTrue(vault.isAllowedAsset(address(usdc)));
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
