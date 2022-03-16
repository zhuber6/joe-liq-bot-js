const { time, snapshot } = require("@openzeppelin/test-helpers");
util = require('util');

const { createContractsDict, tokenExp} = require('../common/contractsDict.js');

const main = async () => {

  const borrowerAddress = "0xf5096073d1bc819b28decf9e178ffb8a8c6af11a";

  // get wallets as signer
  const [myAccount] = await hre.ethers.getSigners();

  // Setup all token contracts with accounts
  contractsDict = createContractsDict(myAccount);

  
  const FlashLiquidatorFactory = await hre.ethers.getContractFactory('FlashLiquidator');
  // const myLiquidatorContract = await FlashLiquidatorFactory.attach("0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690");
  const myLiquidatorContract = await FlashLiquidatorFactory.attach("0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690");
  // const myLiquidatorContract = await FlashLiquidatorFactory.attach(fujiDeployed);

  // // deploy flashloan Borrower contract
  // const myLiquidatorContract = await FlashLiquidatorFactory.deploy(
  //   contractsDict.joetroller.address,
  //   contractsDict.joerouter.address
  // );
  // await myLiquidatorContract.deployed();
  // console.log("Flash Loan liquidator contract deployed to:", myLiquidatorContract.address);


  const borrowjTokenUnderlying = "MIM";
  const borrowjToken           = "j" + borrowjTokenUnderlying;
  const flashjTokenUnderlying  = "WAVAX";
  const flashjToken            = "j" + flashjTokenUnderlying;
  const supplyjTokenUnderlying = "WETH";
  const supplyjToken           = "j" + supplyjTokenUnderlying;

  const borrowTokenExp = tokenExp[contractsDict[borrowjTokenUnderlying].address];
  const flashTokenExp  = tokenExp[contractsDict[flashjTokenUnderlying].address];

  // Jump ahead in time
  await ethers.provider.send("evm_increaseTime", [60*60*24*1*3])
  await ethers.provider.send('evm_mine');

  tx = await contractsDict[borrowjToken].borrowBalanceCurrent(borrowerAddress);
  receipt = tx.wait();

  initialAvax = await hre.ethers.provider.getBalance(myAccount.address);

  borrowTokenBalance = await contractsDict[borrowjToken].borrowBalanceStored(borrowerAddress);

  // Get current liquidity of account
  [err, liq, short] = await contractsDict.joetroller.getAccountLiquidity(borrowerAddress);
  if (err != 0)  { console.log("Error getting liquidity"); return; }

  console.log("Borrower Liquidity: %d", liq / 1e18);
  console.log("Borrower Shortfall: %d", short / 1e18);
  
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