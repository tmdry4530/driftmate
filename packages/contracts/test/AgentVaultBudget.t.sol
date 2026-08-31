// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {MockERC3009} from "../src/MockERC3009.sol";
import {MockDex} from "../src/MockDex.sol";

/**
 * 운영비가 거래 한도를 우회하는 통로가 되지 않는지 검증한다.
 *
 * 예산을 둘로 나눴다면 운영비 쪽으로 지출하면서 거래 예산을 온전히 남기는 우회가
 * 가능하다. 단일 예산이라는 선택이 실제로 그 구멍을 막는지 확인하는 것이 이 파일의 목적이다.
 */
contract AgentVaultBudgetTest is Test {
    AgentVault internal vault;
    MockERC3009 internal token;
    MockERC3009 internal usdc;
    MockDex internal dex;

    address internal alice = address(0xA11CE);
    address internal executor = address(0xE0E0);
    address internal attacker = address(0xBAD);

    uint256 internal constant BUDGET = 5_000e6; // $5000
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
        dex.addLiquidity(100_000e18, 200_000_000e6); // 깊은 풀 — 가격 변동을 줄여 한도만 본다

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
            quoteAsset: address(usdc),
            maxTradeValue: 1_000e6,
            autoThreshold: 100e6,
            budget: BUDGET,
            expiry: uint64(block.timestamp + 30 days),
            allowedAssets: assets,
            allowedDexes: dexes
        });
    }

    function _order(uint256 amountIn) internal view returns (AgentVault.SwapOrder memory) {
        return AgentVault.SwapOrder({
            dex: address(dex),
            tokenIn: address(token),
            tokenOut: address(usdc),
            amountIn: amountIn,
            minAmountOut: 0
        });
    }

    // --- 단일 예산 -----------------------------------------------------------

    function test_costAndTradeShareOneBudget() public {
        vm.startPrank(executor);
        vault.chargeCost(1_000e6, bytes32("c1"), 0);
        assertEq(vault.budgetSpent(), 1_000e6);

        vault.execute(_order(0.5e18), bytes32("t1"), CHAR, EVIDENCE); // 약 $1000
        vm.stopPrank();

        // 둘이 같은 통에서 빠진다 (R3.7).
        assertApproxEqRel(vault.budgetSpent(), 2_000e6, 0.001e18);
    }

    /// 운영비를 많이 쓰면 그만큼 거래 여력이 준다 — 이것이 우회를 막는 방식이다.
    function test_costReducesTradeCapacity() public {
        vm.startPrank(executor);
        vault.chargeCost(4_500e6, bytes32("c2"), 0); // 예산 $5000 중 $4500 소진

        // 남은 여력은 $500. $1000짜리 거래는 들어갈 수 없다.
        vm.expectRevert(AgentVault.BudgetExhausted.selector);
        vault.execute(_order(0.5e18), bytes32("t2"), CHAR, EVIDENCE);
        vm.stopPrank();
    }

    /// 반대 방향도 성립한다 — 거래를 하면 운영비 여력이 준다.
    function test_tradeReducesCostCapacity() public {
        vm.startPrank(executor);
        // 하드캡이 $1000이므로 나눠서 넣는다. 4회 × 약 $1000 = 약 $4000.
        for (uint256 i = 0; i < 4; i++) {
            vault.execute(_order(0.5e18), bytes32(i + 200), CHAR, EVIDENCE);
        }

        // 남은 여력은 약 $1000. $1500짜리 운영비는 들어갈 수 없다.
        vm.expectRevert(AgentVault.BudgetExhausted.selector);
        vault.chargeCost(1_500e6, bytes32("c3"), 0);
        vm.stopPrank();
    }

    function test_costChargeEmitsEvent() public {
        vm.recordLogs();
        vm.prank(executor);
        vault.chargeCost(123e6, bytes32("c4"), 1);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool saw;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("CostCharged(bytes32,uint256,uint8)")) saw = true;
        }
        assertTrue(saw);
    }

    function test_nonExecutorCannotChargeCost() public {
        vm.prank(attacker);
        vm.expectRevert(AgentVault.NotExecutor.selector);
        vault.chargeCost(1e6, bytes32("c5"), 0);
    }

    function test_ownerCannotChargeCost() public {
        vm.prank(alice);
        vm.expectRevert(AgentVault.NotExecutor.selector);
        vault.chargeCost(1e6, bytes32("c6"), 0);
    }

    function test_costBlockedAfterRevoke() public {
        vm.prank(alice);
        vault.revoke();

        vm.prank(executor);
        vm.expectRevert(AgentVault.NotExecutor.selector);
        vault.chargeCost(1e6, bytes32("c7"), 0);
    }

    // --- 불변식 (fuzz) --------------------------------------------------------

    /// 어떤 운영비 조합으로도 예산을 넘길 수 없다.
    function testFuzz_costNeverExceedsBudget(uint96 a, uint96 b, uint96 c) public {
        vm.startPrank(executor);
        uint96[3] memory amounts = [a, b, c];
        for (uint256 i = 0; i < 3; i++) {
            try vault.chargeCost(amounts[i], bytes32(i + 100), 0) {} catch {}
            // 성공했든 되돌려졌든 불변식은 항상 성립해야 한다.
            assertLe(vault.budgetSpent(), BUDGET);
        }
        vm.stopPrank();
    }

    /// 운영비와 거래를 섞어도 총 지출은 예산을 넘지 못한다 (R11.6).
    function testFuzz_mixedSpendingNeverExceedsBudget(uint96 cost, uint64 tradeAmount) public {
        uint256 amountIn = bound(uint256(tradeAmount), 1e12, 1e18);

        vm.startPrank(executor);
        try vault.chargeCost(cost, bytes32("fc"), 0) {} catch {}
        assertLe(vault.budgetSpent(), BUDGET);

        try vault.execute(_order(amountIn), bytes32("ft"), CHAR, EVIDENCE) {} catch {}
        assertLe(vault.budgetSpent(), BUDGET);
        vm.stopPrank();
    }

    /// 운영비를 잘게 쪼개 반복해도 우회되지 않는다.
    function testFuzz_repeatedSmallCostsCannotOverflowBudget(uint8 rounds, uint96 unit) public {
        uint256 n = bound(uint256(rounds), 1, 40);
        uint256 amount = bound(uint256(unit), 1, 1_000e6);

        vm.startPrank(executor);
        for (uint256 i = 0; i < n; i++) {
            try vault.chargeCost(amount, bytes32(i + 1000), 0) {} catch {}
        }
        vm.stopPrank();

        assertLe(vault.budgetSpent(), BUDGET);
    }

    // --- 실망 신호 -----------------------------------------------------------

    function test_ownerCanSignalDisappointment() public {
        vm.recordLogs();
        vm.prank(alice);
        vault.signalDisappointment();

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool saw;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("Disappointed(uint256)")) saw = true;
        }
        assertTrue(saw);
    }

    function test_onlyOwnerCanSignalDisappointment() public {
        vm.prank(executor);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.signalDisappointment();

        vm.prank(attacker);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.signalDisappointment();
    }
}
