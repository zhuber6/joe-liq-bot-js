// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "./Interfaces/ERC3156FlashLenderInterface.sol";
import "./Interfaces/ERC3156FlashBorrowerInterface.sol";
import "./Interfaces/JoeLendingInterface.sol";
import "./Interfaces/IJoeRouter02.sol";
import "./Interfaces/IERC20.sol";


// FlashLiquidator
contract FlashLiquidator is ERC3156FlashBorrowerInterface {

    // Events
    event Swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event Liquidated(
        address borrower,
        uint256 repayAmount,
        address jTokenBorrowed,
        address jTokenSupplied
    );

    event Profit(
        address flashLoanToken,
        uint256 profitInFlashToken,
        address profitSentTo
    );

    // Constructor variables
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
        address borrowerToLiquidate,
        address jTokenBorrowed,
        address jTokenBorrowedUnderlying,
        address jTokenSupplied,
        address jTokenSuppliedUnderlying
    ) external {

        // Calculate amount to get for flash loan
        uint256 flashLoanAmount = getFlashLoanAmount(
            borrowerToLiquidate,
            jTokenBorrowedUnderlying,
            jTokenBorrowed,
            flashLoanToken
        );

        // Set data bytes to pass through to onFlashLoan function
        bytes memory data = abi.encode(
            flashLoanToken,
            flashLoanAmount,
            borrowerToLiquidate,
            jTokenBorrowed,
            jTokenBorrowedUnderlying,
            jTokenSupplied,
            jTokenSuppliedUnderlying
        );

        // Call flash loan function
        ERC3156FlashLenderInterface(flashloanLender).flashLoan(this, address(this), flashLoanAmount, data);

        // Transfer remaining WAVAX to owner
        IERC20(flashLoanToken).transfer(
            owner,
            IERC20(flashLoanToken).balanceOf(address(this))
        );
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

        require(
            IERC20(flashLoanToken).balanceOf(address(this)) > (amount + fee), 
            "Seized amount less than flashloan amount plus fee"
        );

        // Emit event showing profit of liquidation
        emit Profit( 
            flashLoanToken,
            IERC20(flashLoanToken).balanceOf(address(this)) - (amount + fee),
            owner
        );

        // Approve flash loan lender to pay back loan
        IERC20(token).approve(msg.sender, amount + fee);

        // // Transfer remaining WAVAX to owner
        // IERC20(flashLoanToken).transfer(
        //     owner,
        //     IERC20(flashLoanToken).balanceOf(address(this)) - (amount + fee)
        // );

        // Finish loan
        return keccak256("ERC3156FlashBorrowerInterface.onFlashLoan");
    }


    function getFlashLoanAmount( 
        address borrower,
        address jTokenBorrowedUnderlying,
        address jTokenBorrowed,
        address flashLoanToken
    ) internal view returns (uint256 flashLoanAmount) {

        // Get borrowed token balance
        uint256 borrowBalance = IJToken(jTokenBorrowed).borrowBalanceStored(borrower);
        uint256 closeFactor = JOE_TROLLER.closeFactorMantissa();

        // Get repay amount in borrowed jTokenUnderylying
        uint256 repayAmountBorrowed = borrowBalance * closeFactor / (10 ** 18);
        
        address[] memory path = new address[](2);
        path[0] = flashLoanToken;
        path[1] = jTokenBorrowedUnderlying;

        uint256[] memory amounts = new uint256[](2);

        // Get repay amount in flash loaned token
        amounts = JOE_ROUTER.getAmountsIn(
            repayAmountBorrowed,
            path
        );

        // Return amount to flash loan
        flashLoanAmount = amounts[0];

        require(
            amounts[0] > 0, 
            "Repay amount calculated to be zero"
        );

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

        emit Swap( tokenIn, tokenOut, amount, IERC20(tokenOut).balanceOf(address(this)) );
    }

    function liquidate(
        address borrower,
        address jTokenBorrowed,
        address jTokenBorrowedUnderlying,
        address jTokenSupplied,
        uint    repayAmount
    ) internal {

        IERC20(jTokenBorrowedUnderlying).approve(jTokenBorrowed, repayAmount);
        uint err = IJErc20(jTokenBorrowed).liquidateBorrow(
            borrower,
            repayAmount,
            IJToken(jTokenSupplied)
        );
        require(err == 0, "Error while attempting liquidation");

        require(
            IJToken(jTokenSupplied).balanceOf(address(this)) > 0,
            "Seized jTokens is zero"
        );

        emit Liquidated(borrower, repayAmount, jTokenBorrowed, jTokenSupplied );
    }


    receive() external payable {}

}
