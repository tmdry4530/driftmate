// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

/// 스캐폴딩이 서 있는지 확인하는 최소 테스트. 실제 컨트랙트는 T6부터 들어온다.
contract SmokeTest is Test {
    function test_toolchain() public pure {
        assertEq(uint256(1), uint256(1));
    }
}
