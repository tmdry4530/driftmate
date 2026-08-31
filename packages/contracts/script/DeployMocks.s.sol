// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {MockERC3009} from "../src/MockERC3009.sol";
import {MockDex} from "../src/MockDex.sol";

/**
 * @notice 검증용 토큰 2종과 DEX를 배포하고 유동성을 넣는다.
 *
 * 체인 중립 설계라 대상 체인의 DEX·자산에 기댈 수 없다. 로컬 Anvil이든 어떤 EVM이든
 * 이 스크립트 하나로 같은 검증 환경이 선다 (ADR-0002).
 */
contract DeployMocks is Script {
    uint256 internal constant TOKEN_LIQUIDITY = 1_000e18;
    uint256 internal constant USDC_LIQUIDITY = 2_000_000e6; // TOKEN 1개 = 2000 USDC

    function run() external {
        vm.startBroadcast();

        MockERC3009 token = new MockERC3009("Token A", "TKA", 18);
        MockERC3009 usdc = new MockERC3009("Mock USD", "mUSD", 6);
        MockDex dex = new MockDex(address(token), address(usdc));

        token.mint(msg.sender, TOKEN_LIQUIDITY);
        usdc.mint(msg.sender, USDC_LIQUIDITY);
        token.approve(address(dex), type(uint256).max);
        usdc.approve(address(dex), type(uint256).max);
        dex.addLiquidity(TOKEN_LIQUIDITY, USDC_LIQUIDITY);

        vm.stopBroadcast();

        console2.log("TOKEN     ", address(token));
        console2.log("USDC      ", address(usdc));
        console2.log("DEX       ", address(dex));
        console2.log("spotE18   ", dex.getSpotPriceE18(address(token)));
    }
}
