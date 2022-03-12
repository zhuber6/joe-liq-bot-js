const { time, snapshot } = require("@openzeppelin/test-helpers");
util = require('util');

const { createContractsDict } = require('../common/contractsDict.js');

const main = async () => {

  const borrowerAddress = "0xf5096073d1bc819b28decf9e178ffb8a8c6af11a";

  // get wallets as signer
  const [myAccount] = await hre.ethers.getSigners();
  const FlashLiquidatorFactory = await hre.ethers.getContractFactory('FlashLiquidator');
  const myLiquidatorContract = await FlashLiquidatorFactory.attach("0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690");

  // Setup all token contracts with accounts
  contractsDict = createContractsDict(myAccount);

  const borrowjToken           = "jMIM";
  const borrowjTokenUnderlying = "MIM";
  const flashjToken            = "jWAVAX";
  const flashjTokenUnderlying  = "WAVAX";
  const supplyjToken           = "jWBTC";
  const supplyjTokenUnderlying = "WBTC";

  const borrowTokenExp = 1e18;
  const flashTokenExp  = 1e18;

  // --------------------------------------------------
  // First get account 2 underwater
  // --------------------------------------------------

  initialAvax = await hre.ethers.provider.getBalance(myAccount.address);

  borrowTokenBalance = await contractsDict[borrowjToken].borrowBalanceStored(borrowerAddress);
  
  // Calculate repay amount
  const closeFactor = await contractsDict.joetroller.closeFactorMantissa();
  let repayAmountBorrowed = (borrowTokenBalance * closeFactor) / 1e18;

  const [repayAmount, temp] = await contractsDict.joerouter.getAmountsIn(
    BigInt(Math.trunc(repayAmountBorrowed)),
    [ contractsDict[flashjTokenUnderlying].address, contractsDict[borrowjTokenUnderlying].address ]
  );

  console.log("Calculated %s repay amount %d", borrowjTokenUnderlying, Math.trunc(repayAmountBorrowed) / borrowTokenExp);
  console.log("Calculated %s repay amount %d", flashjTokenUnderlying, repayAmount / flashTokenExp);

  const txFlash = await myLiquidatorContract.doFlashloan(
    contractsDict[flashjToken].address,             // address: flashloanLender
    contractsDict[flashjTokenUnderlying].address,   // address: flashLoanToken
    borrowerAddress,                                // address: borrowerToLiquidate
    contractsDict[borrowjToken].address,            // address: jTokenBorrowed
    contractsDict[borrowjTokenUnderlying].address,  // address: jTokenBorrowedUnderlying
    contractsDict[supplyjToken].address,            // address: jTokenSupplied
    contractsDict[supplyjTokenUnderlying].address   // address: jTokenSuppliedUnderlying
  )

  await new Promise(resolve => setTimeout(resolve, 1000)); // 3 sec
};

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

runMain();