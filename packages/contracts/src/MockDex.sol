// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MockDex
 * @notice 상수곱(x·y=k) 방식의 2토큰 풀.
 *
 * 체인 중립 설계라 특정 체인의 DEX에 의존할 수 없어 직접 배포한다 (ADR-0002).
 * 판단에 쓰는 가격과 체결하는 가격이 같은 원천이 되도록, PriceSource는 이 풀의
 * 스팟을 읽는다.
 *
 * 얕은 풀에서는 스팟 가격을 조작할 수 있다. 이번 범위는 실자금을 다루지 않으므로
 * 감수하지만, 실자금 단계 전에 TWAP 또는 오라클 교차검증이 필요하다.
 */
contract MockDex {
    uint256 private constant FEE_BPS = 30; // 0.3%
    uint256 private constant BPS = 10_000;
    uint256 private constant PRICE_SCALE = 1e18;

    address public immutable token0;
    address public immutable token1;

    uint256 public reserve0;
    uint256 public reserve1;

    event LiquidityAdded(uint256 amount0, uint256 amount1);
    event Swap(address indexed tokenIn, uint256 amountIn, address indexed tokenOut, uint256 amountOut, address to);

    error UnknownToken();
    error InsufficientOutput();
    error InsufficientLiquidity();

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function addLiquidity(uint256 amount0, uint256 amount1) external {
        IERC20Minimal(token0).transferFrom(msg.sender, address(this), amount0);
        IERC20Minimal(token1).transferFrom(msg.sender, address(this), amount1);
        reserve0 += amount0;
        reserve1 += amount1;
        emit LiquidityAdded(amount0, amount1);
    }

    function _reservesFor(address tokenIn) private view returns (uint256 reserveIn, uint256 reserveOut) {
        if (tokenIn == token0) return (reserve0, reserve1);
        if (tokenIn == token1) return (reserve1, reserve0);
        revert UnknownToken();
    }

    function getAmountOut(address tokenIn, uint256 amountIn) public view returns (uint256) {
        (uint256 reserveIn, uint256 reserveOut) = _reservesFor(tokenIn);
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        uint256 amountInAfterFee = (amountIn * (BPS - FEE_BPS)) / BPS;
        return (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee);
    }

    /**
     * @notice tokenIn 1 최소단위당 tokenOut 최소단위 가격, 1e18 고정소수.
     * @dev 엔진의 PriceSnapshot.priceE18과 같은 정의다 — 최소단위 기준이라 decimals 보정이 없다.
     */
    function getSpotPriceE18(address tokenIn) external view returns (uint256) {
        (uint256 reserveIn, uint256 reserveOut) = _reservesFor(tokenIn);
        if (reserveIn == 0) revert InsufficientLiquidity();
        return (reserveOut * PRICE_SCALE) / reserveIn;
    }

    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut, address to)
        external
        returns (uint256 amountOut)
    {
        address tokenOut = tokenIn == token0 ? token1 : tokenIn == token1 ? token0 : address(0);
        if (tokenOut == address(0)) revert UnknownToken();

        amountOut = getAmountOut(tokenIn, amountIn);
        // 체결가가 예상보다 나쁘면 되돌린다. 볼트도 같은 검사를 하지만 여기서도 막는다 (R6.4).
        if (amountOut < minAmountOut) revert InsufficientOutput();

        IERC20Minimal(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20Minimal(tokenOut).transfer(to, amountOut);

        if (tokenIn == token0) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        }

        emit Swap(tokenIn, amountIn, tokenOut, amountOut, to);
    }
}
