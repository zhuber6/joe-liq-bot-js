const { createContractsDict, tokenIdDict, tokenExp, joeToErc20Dict } = require('../common/contractsDict.js');

const main = async () => {

  const FlashLiquidatorFactory = await hre.ethers.getContractFactory('FlashLiquidator');
  const myLiquidatorContract = await FlashLiquidatorFactory.attach("0x848b3aBd5f73F96baa462a3a794f03D74ED4cf81");

  const [account1, account2] = await ethers.getSigners();
  contractsDictAcct1 = createContractsDict(account1);
  contractsDictAcct2 = createContractsDict(account2);

  myLiquidatorContract.on("Swap", async (
    tokenIn,
    tokenOut,
    amountIn,
    amountOut
  ) => {
    console.log(" ------------  Swap:  ------------");
    console.log("Token in:    ", tokenIdDict[tokenIn] );
    console.log("Token out:   ", tokenIdDict[tokenOut] );
    console.log("Amount in:   ", amountIn / tokenExp[ tokenIn ]);
    console.log("Amount out:  ", amountOut / tokenExp[ tokenOut ]);
  });

  myLiquidatorContract.on("Liquidated", async (
    borrower,
    repayAmount,
    jTokenBorrowed,
    jTokenSupplied
  ) => {
    console.log(" ------------  Liquidated:  ------------");
    console.log("Borrower Liquidated: ", borrower);
    console.log("Repaid Amount:       ", repayAmount / tokenExp[ joeToErc20Dict[jTokenSupplied] ] );
    console.log("Token Borrowed:      ", tokenIdDict[ joeToErc20Dict[jTokenBorrowed] ] );
    console.log("Token Supplied:      ", tokenIdDict[ joeToErc20Dict[jTokenSupplied] ] );
  });

  myLiquidatorContract.on("Profit", async (
    flashLoanToken,
    profitInFlashToken,
    profitSentTo
  ) => {
    console.log(" ------------  Profit:  ------------");
    console.log("Flash loan token:     ", tokenIdDict[flashLoanToken]);
    console.log("Profit in Flash token:", profitInFlashToken /  tokenExp[ flashLoanToken ] );
    console.log("Profit sent to:       ", profitSentTo );
  });

  // contractsDictAcct1.jWBTC.on("Failure", async (
  //   err,
  //   info,
  //   opaqueError
  // ) => {
  //   console.log("Err:         ", err.toString() );
  //   console.log("info:        ", info.toString() );
  //   console.log("opaqueError: ", opaqueError.toString() );
  // });

  contractsDictAcct2.jWETH.on("Failure", async (
    err,
    info,
    opaqueError
  ) => {
    console.log("Err:         ", err.toString() );
    console.log("info:        ", info.toString() );
    console.log("opaqueError: ", opaqueError.toString() );
  });

  contractsDictAcct1.jDAI.on("Failure", async (
    err,
    info,
    opaqueError
  ) => {
    console.log("Err:         ", err.toString() );
    console.log("info:        ", info.toString() );
    console.log("opaqueError: ", opaqueError.toString() );
  });

  contractsDictAcct2.jWETH.on("Borrow", async (
    borrower,
    borrowAmount,
    accountBorrows,
    totalBorrows
  ) => {
    console.log("borrower:       ", borrower.toString() );
    console.log("borrowAmount:   ", borrowAmount / 1e18 );
    console.log("accountBorrows: ", accountBorrows / 1e18 );
    console.log("totalBorrows:   ", totalBorrows / 1e18 );
  });
  contractsDictAcct1.jDAI.on("Borrow", async (
    borrower,
    borrowAmount,
    accountBorrows,
    totalBorrows
  ) => {
    console.log("borrower:       ", borrower.toString() );
    console.log("borrowAmount:   ", borrowAmount / 1e18 );
    console.log("accountBorrows: ", accountBorrows / 1e18 );
    console.log("totalBorrows:   ", totalBorrows / 1e18 );
  });

  // contractsDictAcct1.jWBTC.on("AccrueInterest", async (
  //   cashPrior,
  //   interestAccumulated,
  //   borrowIndex,
  //   totalBorrows
  // ) => {
  //   console.log("cashPrior:           ", cashPrior );
  //   console.log("interestAccumulated: ", interestAccumulated );
  //   console.log("borrowIndex:         ", borrowIndex );
  //   console.log("totalBorrows:        ", totalBorrows );
  // });
}

const runMain = async () => {
  await main();
};


runMain();