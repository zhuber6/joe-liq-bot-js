const { tokenIdDict, tokenExp, joeToErc20Dict } = require('../common/contractsDict.js');

const joetroller  = "0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC";
const joeOracle   = "0xd7Ae651985a871C1BC254748c40Ecc733110BC2E";
const joeRouter   = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";

const main = async () => {

  const FlashLiquidatorFactory = await hre.ethers.getContractFactory('FlashLiquidator');
  const myLiquidatorContract = await FlashLiquidatorFactory.attach("0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690");

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
}

const runMain = async () => {
  await main();
};


runMain();