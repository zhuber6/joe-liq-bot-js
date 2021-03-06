// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "./ERC3156FlashBorrowerInterface.sol";

interface Joetroller {
    function getAllMarkets() external view returns (IJToken[] memory);
    function getBlockTimestamp() external view returns (uint256);
    function getAssetsIn(address account) external view returns (IJToken[] memory);
    function checkMembership(address account, IJToken jToken) external view returns (bool);
    function enterMarkets(address[] calldata jTokens) external returns (uint256[] memory);
    function exitMarket(address jToken) external returns (uint256);
    function isMarketListed(address jTokenAddress) external view returns (bool);
    function oracle() external view returns (PriceOracle);
    function closeFactorMantissa() external view returns (uint256);
    function liquidationIncentiveMantissa() external view returns (uint256);
    function mintAllowed(
        address jToken,
        address minter,
        uint256 mintAmount
    ) external returns (uint256);

    function mintVerify(
        address jToken,
        address minter,
        uint256 mintAmount,
        uint256 mintTokens
    ) external;

    function redeemAllowed(
        address jToken,
        address redeemer,
        uint256 redeemTokens
    ) external returns (uint256);

    function redeemVerify(
        address jToken,
        address redeemer,
        uint256 redeemAmount,
        uint256 redeemTokens
    ) external;

    function borrowAllowed(
        address jToken,
        address borrower,
        uint256 borrowAmount
    ) external returns (uint256);

    function borrowVerify(
        address jToken,
        address borrower,
        uint256 borrowAmount
    ) external;

    function repayBorrowAllowed(
        address jToken,
        address payer,
        address borrower,
        uint256 repayAmount
    ) external returns (uint256);

    function repayBorrowVerify(
        address jToken,
        address payer,
        address borrower,
        uint256 repayAmount,
        uint256 borrowerIndex
    ) external;

    function liquidateBorrowAllowed(
        address jTokenBorrowed,
        address jTokenCollateral,
        address liquidator,
        address borrower,
        uint256 repayAmount
    ) external returns (uint256);

    function liquidateBorrowVerify(
        address jTokenBorrowed,
        address jTokenCollateral,
        address liquidator,
        address borrower,
        uint256 repayAmount,
        uint256 seizeTokens
    ) external;

    function seizeAllowed(
        address jTokenCollateral,
        address jTokenBorrowed,
        address liquidator,
        address borrower,
        uint256 seizeTokens
    ) external returns (uint256);

    function seizeVerify(
        address jTokenCollateral,
        address jTokenBorrowed,
        address liquidator,
        address borrower,
        uint256 seizeTokens
    ) external;

    function transferAllowed(
        address jToken,
        address src,
        address dst,
        uint256 transferTokens
    ) external returns (uint256);

    function transferVerify(
        address jToken,
        address src,
        address dst,
        uint256 transferTokens
    ) external;
    
    function liquidateCalculateSeizeTokens(
        address jTokenBorrowed,
        address jTokenCollateral,
        uint256 repayAmount
    ) external view returns (uint256, uint256);

    function getAccountLiquidity(address account)
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        );

    function getHypotheticalAccountLiquidity(
        address account,
        address jTokenModify,
        uint256 redeemTokens,
        uint256 borrowAmount
    )
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        );
}

interface IJToken {
    /*** Market Events ***/

    event AccrueInterest(uint256 cashPrior, uint256 interestAccumulated, uint256 borrowIndex, uint256 totalBorrows);
    event Mint(address minter, uint256 mintAmount, uint256 mintTokens);
    event Redeem(address redeemer, uint256 redeemAmount, uint256 redeemTokens);
    event Borrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows);
    event RepayBorrow(
        address payer,
        address borrower,
        uint256 repayAmount,
        uint256 accountBorrows,
        uint256 totalBorrows
    );
    event LiquidateBorrow(
        address liquidator,
        address borrower,
        uint256 repayAmount,
        address jTokenCollateral,
        uint256 seizeTokens
    );
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Failure(uint256 error, uint256 info, uint256 detail);

    /*** User Interface ***/

    function decimals() external view returns (uint8);
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
    function borrowBalanceStored(address account) external view returns (uint256);
    function exchangeRateCurrent() external returns (uint256);
    function exchangeRateStored() external view returns (uint256);
    function getCash() external view returns (uint256);
    function accrueInterest() external returns (uint256);
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
        IJToken jTokenCollateral
    ) external returns (uint256);
}

interface IJWrappedNative {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
    function borrow(uint256 borrowAmount) external returns (uint256);
    function repayBorrow(uint256 repayAmount) external returns (uint256);
    function repayBorrowBehalf(address borrower, uint256 repayAmount) external returns (uint256);
    function mintNative() external payable returns (uint256);
    function redeemNative(uint256 redeemTokens) external returns (uint256);
    function redeemUnderlyingNative(uint256 redeemAmount) external returns (uint256);
    function borrowNative(uint256 borrowAmount) external returns (uint256);
    function repayBorrowNative() external payable returns (uint256);
    function repayBorrowBehalfNative(address borrower) external payable returns (uint256);
    function liquidateBorrowNative(
        address borrower,
        IJToken jTokenCollateral
        ) external payable returns (uint256);
    function flashLoan(
        ERC3156FlashBorrowerInterface receiver,
        address initiator,
        uint256 amount,
        bytes calldata data
    ) external returns (bool);
}

interface PriceOracle {
    function getUnderlyingPrice(IJToken jToken) external view returns (uint256);
}