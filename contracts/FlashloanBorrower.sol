// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "./Interfaces/ERC3156FlashLenderInterface.sol";
import "./Interfaces/ERC3156FlashBorrowerInterface.sol";
import "./Interfaces/JoeLendingInterface.sol";
import "./Interfaces/IJoeRouter02.sol";
import "./Interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";


import "hardhat/console.sol";

// FlashloanBorrower
contract FlashloanBorrower is ERC3156FlashBorrowerInterface {

    using SafeMath for uint;
    
    IJoeRouter02 public JOE_ROUTER;
    Joetroller public JOE_TROLLER;
    address public owner;
    constructor(address _joetroller, address _joeRouter) {
        owner = msg.sender;
        JOE_TROLLER = Joetroller(_joetroller);
        JOE_ROUTER = IJoeRouter02(_joeRouter);
    }

    address internal constant WAVAX_TOKEN = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    // Flash loan
    function doFlashloan(
        address flashloanLender,
        address flashLoanToken,
        uint256 flashLoanAmount,
        address borrowerToLiquidate,
        address jTokenBorrowed,
        address jTokenBorrowedUnderlying,
        address jTokenSupplied,
        address jTokenSuppliedUnderlying
    ) external {
        bytes memory data = abi.encode(
            flashLoanToken,
            flashLoanAmount,
            borrowerToLiquidate,
            jTokenBorrowed,
            jTokenBorrowedUnderlying,
            jTokenSupplied,
            jTokenSuppliedUnderlying
        );

        ERC3156FlashLenderInterface(flashloanLender).flashLoan(this, address(this), flashLoanAmount, data);
    }

    // Function called from flash loan lender contract
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) override external returns (bytes32) {
        require(JOE_TROLLER.isMarketListed(msg.sender), "untrusted message sender");
        require(initiator == address(this), "FlashBorrower: Untrusted loan initiator");

        // Decode paramaters for liquidation
        (
            address flashLoanToken,
            uint256 flashLoanAmount,
            address borrowerToLiquidate,
            address jTokenBorrowed,
            address jTokenBorrowedUnderlying,
            address jTokenSupplied,
            address jTokenSuppliedUnderlying
        ) = abi.decode(
             data, (address, uint256, address, address, address, address, address)
        );

        // Swap flash loaned tokens for repay tokens
        swapTokensForTokens( 
            flashLoanToken,
            jTokenBorrowedUnderlying,
            flashLoanAmount
        );

        // Attempt to liquidate borrower
        liquidate(
            borrowerToLiquidate,
            jTokenBorrowed,
            jTokenBorrowedUnderlying,
            jTokenSupplied,
            IERC20(jTokenBorrowedUnderlying).balanceOf(address(this))
        );

        // Redeem jTokens for underlying asset
        IJErc20(jTokenSupplied).redeem( IJToken(jTokenSupplied).balanceOf(address(this)) );
        require(
            IERC20(jTokenSuppliedUnderlying).balanceOf(address(this)) > 0, 
            "Seized underlying assets is zero"
        );

        // Swap seized assets for WAVAX
        swapTokensForTokens(
            jTokenSuppliedUnderlying,
            flashLoanToken,
            IERC20(jTokenSuppliedUnderlying).balanceOf(address(this))
        );

        // Approve flash loan lender to pay back loan
        IERC20(token).approve(msg.sender, amount + fee);

        // Transfer remaining WAVAX to owner
        IERC20(flashLoanToken).transfer(
            owner,
            IERC20(flashLoanToken).balanceOf(address(this)) - (amount + fee)
        );

        // Finish loan
        return keccak256("ERC3156FlashBorrowerInterface.onFlashLoan");
    }

    function swapTokensForTokens( 
        address tokenIn,
        address tokenOut,
        uint256 amount
    ) internal {

        require(
            IERC20(tokenIn).balanceOf(address(this)) > 0, 
            "Token in balance is zero"
        );

        address[] memory path;
        if( (WAVAX_TOKEN == tokenIn) || (WAVAX_TOKEN == tokenOut) )
        {
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
        }
        else
        {
            path = new address[](3);
            path[0] = tokenIn;
            path[1] = WAVAX_TOKEN;
            path[2] = tokenOut;
        }


        IERC20(tokenIn).approve(address(JOE_ROUTER), amount);
        JOE_ROUTER.swapExactTokensForTokens(
            amount,
            0,
            path,
            address(this),
            block.timestamp + 60 seconds
        );

        require(
            IERC20(tokenOut).balanceOf(address(this)) > 0, 
            "Token out balance is zero"
        );
    }

    function liquidate(
        address borrower,
        address jTokenBorrowed,
        address jTokenBorrowedUnderlying,
        address jTokenSupplied,
        uint    amount
    ) internal {

        IERC20(jTokenBorrowedUnderlying).approve(jTokenBorrowed, amount);
        uint err = IJErc20(jTokenBorrowed).liquidateBorrow(
            borrower,
            amount,
            IJToken(jTokenSupplied)
        );
        require(err == 0, "Error while attempting liquidation");

        require(
            IJToken(jTokenSupplied).balanceOf(address(this)) > 0,
            "Seized jTokens is zero"
        );
    }


    receive() external payable {}

}
