// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "./Interfaces/ERC3156FlashLenderInterface.sol";
import "./Interfaces/ERC3156FlashBorrowerInterface.sol";
import "./Interfaces/EIP20Interface.sol";
import "./Interfaces/JoeLendingInterface.sol";
import "./Exponential.sol";

import "hardhat/console.sol";

// FlashloanBorrower
contract FlashloanBorrower is ERC3156FlashBorrowerInterface, Exponential {
    
    /**
     * @notice joetroller address
     */
    address public joetroller;
    constructor(address _joetroller) {
        joetroller = _joetroller;
    }

    function doFlashloan(
        address flashloanLender,
        // address borrowToken, // not used, always getting WAVAX
        uint256 borrowAmount,
        address borrowerToLiquidate
    ) external {
        bytes memory data = abi.encode(borrowAmount, borrowerToLiquidate);
        ERC3156FlashLenderInterface(flashloanLender).flashLoan(this, address(this), borrowAmount, data);
    }

    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) override external returns (bytes32) {
        require(Joetroller(joetroller).isMarketListed(msg.sender), "untrusted message sender");
        require(initiator == address(this), "FlashBorrower: Untrusted loan initiator");
        (uint256 borrowAmount, address borrowerToLiquidate ) = abi.decode(data, (uint256, address));
        // (uint256 borrowAmount) = abi.decode(data, (uint256));
        // require(borrowToken == token, "encoded data (borrowToken) does not match"); // Always getting WAVAX from lender
        require(borrowAmount == amount, "encoded data (borrowAmount) does not match");
        EIP20Interface(token).approve(msg.sender, amount + fee); // approve lending contract to get gas fee


        return keccak256("ERC3156FlashBorrowerInterface.onFlashLoan");
    }

    function liquidate(
        address borrower,
        uint256 repayAmount,
        bool erc20,
        address tokenBorrowed,
        address tokenSupplied
    ) external returns ( uint256 ) {
        if (erc20) {
            IJErc20 jErc20Token = IJErc20(tokenBorrowed);
            IJToken jtokenCollateral = IJToken(tokenSupplied);
            jErc20Token.liquidateBorrow( borrower, repayAmount, jtokenCollateral );
        }
        else {
            IJWrappedNative jWrappedToken = IJWrappedNative(tokenBorrowed);
            IJToken jtokenCollateral = IJToken(tokenSupplied);
            jWrappedToken.liquidateBorrow( borrower, repayAmount, jtokenCollateral );
        }
    }

    function getSupplyBalance(address jTokenCollateral) external returns (uint) {
        console.log(IJToken(jTokenCollateral).balanceOfUnderlying(address(this)));
        return IJToken(jTokenCollateral).balanceOfUnderlying(address(this));
    }
}
