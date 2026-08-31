// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockERC3009} from "../src/MockERC3009.sol";
import {MockDex} from "../src/MockDex.sol";

contract MockERC3009Test is Test {
    MockERC3009 internal token;
    uint256 internal signerKey = 0xA11CE;
    address internal signer;

    bytes32 private constant TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    function setUp() public {
        token = new MockERC3009("Mock USD", "mUSD", 6);
        signer = vm.addr(signerKey);
        token.mint(signer, 1_000_000);
        vm.warp(1_000);
    }

    function _sign(address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, signer, to, value, validAfter, validBefore, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(signerKey, digest);
    }

    /// x402 결제 경로가 나중에 붙을 수 있는지는 이 서명 흐름이 도는지에 달려 있다 (R11.4).
    function test_transferWithAuthorization() public {
        bytes32 nonce = keccak256("n1");
        (uint8 v, bytes32 r, bytes32 s) = _sign(address(0xBEEF), 1_000, 0, 2_000, nonce);

        token.transferWithAuthorization(signer, address(0xBEEF), 1_000, 0, 2_000, nonce, v, r, s);

        assertEq(token.balanceOf(address(0xBEEF)), 1_000);
        assertTrue(token.authorizationState(signer, nonce));
    }

    function test_authorizationCannotBeReplayed() public {
        bytes32 nonce = keccak256("n2");
        (uint8 v, bytes32 r, bytes32 s) = _sign(address(0xBEEF), 1_000, 0, 2_000, nonce);

        token.transferWithAuthorization(signer, address(0xBEEF), 1_000, 0, 2_000, nonce, v, r, s);

        vm.expectRevert(MockERC3009.AuthorizationAlreadyUsed.selector);
        token.transferWithAuthorization(signer, address(0xBEEF), 1_000, 0, 2_000, nonce, v, r, s);
    }

    function test_expiredAuthorizationRejected() public {
        bytes32 nonce = keccak256("n3");
        (uint8 v, bytes32 r, bytes32 s) = _sign(address(0xBEEF), 1_000, 0, 999, nonce);

        vm.expectRevert(MockERC3009.AuthorizationExpired.selector);
        token.transferWithAuthorization(signer, address(0xBEEF), 1_000, 0, 999, nonce, v, r, s);
    }

    function test_forgedSignatureRejected() public {
        bytes32 nonce = keccak256("n4");
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, signer, address(0xBEEF), 1_000, 0, 2_000, nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADBAD, digest); // 다른 키로 서명

        vm.expectRevert(MockERC3009.InvalidSignature.selector);
        token.transferWithAuthorization(signer, address(0xBEEF), 1_000, 0, 2_000, nonce, v, r, s);
    }
}

contract MockDexTest is Test {
    MockERC3009 internal tokenA;
    MockERC3009 internal usdc;
    MockDex internal dex;

    function setUp() public {
        tokenA = new MockERC3009("Token A", "TKA", 18);
        usdc = new MockERC3009("Mock USD", "mUSD", 6);

        // TOKEN 1개 = 2000 USDC 가 되도록 유동성을 넣는다.
        tokenA.mint(address(this), 1_000e18);
        usdc.mint(address(this), 2_000_000e6);

        dex = new MockDex(address(tokenA), address(usdc));
        tokenA.approve(address(dex), type(uint256).max);
        usdc.approve(address(dex), type(uint256).max);
        dex.addLiquidity(1_000e18, 2_000_000e6);
    }

    function test_spotPriceMatchesEngineDefinition() public view {
        // 엔진의 priceE18과 같은 정의: 1 최소단위당 상대 토큰 최소단위 × 1e18.
        // TOKEN(18dec) 1 최소단위 = 2e-9 USDC 최소단위 → 2e9
        assertEq(dex.getSpotPriceE18(address(tokenA)), 2_000_000_000);
        // USDC(6dec) 1 최소단위 = 5e8 TOKEN 최소단위 → 5e26
        assertEq(dex.getSpotPriceE18(address(usdc)), 500_000_000_000_000_000_000_000_000);
    }

    function test_spotPricesAreReciprocal() public view {
        // 두 방향 가격은 1e36에서 역수 관계여야 한다. 정의가 어긋나면 여기서 깨진다.
        uint256 a = dex.getSpotPriceE18(address(tokenA));
        uint256 b = dex.getSpotPriceE18(address(usdc));
        assertEq(a * b, 1e36);
    }

    function test_swapMovesPrice() public {
        uint256 before = dex.getSpotPriceE18(address(tokenA));

        tokenA.mint(address(this), 10e18);
        dex.swap(address(tokenA), 10e18, 0, address(this));

        // TOKEN을 팔았으니 TOKEN 가격은 내려가야 한다.
        assertLt(dex.getSpotPriceE18(address(tokenA)), before);
        assertGt(usdc.balanceOf(address(this)), 0);
    }

    function test_swapRespectsMinAmountOut() public {
        tokenA.mint(address(this), 1e18);
        uint256 expected = dex.getAmountOut(address(tokenA), 1e18);

        vm.expectRevert(MockDex.InsufficientOutput.selector);
        dex.swap(address(tokenA), 1e18, expected + 1, address(this));
    }

    function test_unknownTokenRejected() public {
        vm.expectRevert(MockDex.UnknownToken.selector);
        dex.getSpotPriceE18(address(0xDEAD));
    }
}
