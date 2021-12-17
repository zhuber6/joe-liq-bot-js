// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;


interface ERC3156FlashBorrowerInterface {
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32);
}

interface ERC3156FlashLenderInterface {
    function maxFlashLoan(address token) external view returns (uint256);
    function flashFee(address token, uint256 amount) external view returns (uint256);
    function flashLoan(
        ERC3156FlashBorrowerInterface receiver,
        address initiator,
        uint256 amount,
        bytes calldata data
    ) external returns (bool);
}

interface JoetrollerInterface {
    function enterMarkets(address[] calldata jTokens) external returns (uint256[] memory);
    function liquidateCalculateSeizeTokens(
        address jTokenBorrowed,
        address jTokenCollateral,
        uint256 repayAmount
    ) external view returns (uint256, uint256);
}

interface JTokenInterface {
    function transfer(address dst, uint256 amount) external returns (bool);
    function transferFrom(
        address src,
        address dst,
        uint256 amount
    ) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function balanceOfUnderlying(address owner) external returns (uint256);
    function getAccountSnapshot(address account)
       external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        );
    function borrowRatePerSecond() external view returns (uint256);
    function supplyRatePerSecond() external view returns (uint256);
    function totalBorrowsCurrent() external returns (uint256);
    function borrowBalanceCurrent(address account) external returns (uint256);
    function getCash() external view returns (uint256);
    function seize(
       address liquidator,
        address borrower,
        uint256 seizeTokens
    ) external returns (uint256);
}

interface IJErc20 {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
    function borrow(uint256 borrowAmount) external returns (uint256);
    function repayBorrow(uint256 repayAmount) external returns (uint256);
    function repayBorrowBehalf(address borrower, uint256 repayAmount) external returns (uint256);
    function liquidateBorrow(
        address borrower,
        uint256 repayAmount,
        JTokenInterface jTokenCollateral
    ) external returns (uint256);
    function _addReserves(uint256 addAmount) external returns (uint256);
}

interface IJWrappedNative {
    function mintNative() external payable returns (uint256);
    function redeemNative(uint256 redeemTokens) external returns (uint256);
    function redeemUnderlyingNative(uint256 redeemAmount) external returns (uint256);
    function borrowNative(uint256 borrowAmount) external returns (uint256);
    function repayBorrowNative() external payable returns (uint256);
    function repayBorrowBehalfNative(address borrower) external payable returns (uint256);
    function liquidateBorrowNative(address borrower, JTokenInterface jTokenCollateral)
        external
        payable
        returns (uint256);
    function flashLoan(
        ERC3156FlashBorrowerInterface receiver,
        address initiator,
        uint256 amount,
        bytes calldata data
    ) external returns (bool);
    function _addReservesNative() external payable returns (uint256);
}

contract executeLiquidation {

}