const { time, snapshot } = require("@openzeppelin/test-helpers");
util = require('util');
joetrollerAbi     = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/Joetroller.json');
joeOracleAbi      = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/PriceOracle.json');
jTokenAbi         = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/IJToken.json');
jErc20Abi         = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/IJErc20.json');
erc20Abi          = require('../artifacts/contracts/Interfaces/IERC20.sol/IERC20.json');
wavaxAbi          = require('../artifacts/contracts/Interfaces/IWAVAX.sol/IWAVAX.json');
jWrappedNativeAbi = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/IJWrappedNative.json');
joeRouterAbi      = require('../artifacts/contracts/Interfaces/IJoeRouter02.sol/IJoeRouter02.json');

const {createContractsDict} = require('../common/contractsDict.js');
const { swapAvaxForTokens, swapTokensForAvax } = require('../common/functions.js');

const pino = require('pino');
const pretty = require('pino-pretty');
const stream = pretty({
  colorize: true
});
const logger = pino(stream);

const LOG_TRACE = 0;
const LOG_DEBUG = 1;
const LOG_INFO  = 2;
const LOG_WARN  = 3;
const LOG_ERROR = 4;
const LOG_FATAL = 5;

const main = async () => {

  logger.level = 'trace'

  let tx;
  let receipt;
  let price;
  let borrowAmount;

  const avaxToSupply = 100;

  // get wallets as signer
  const [account1, account2] = await hre.ethers.getSigners();
  const FlashLiquidatorFactory = await hre.ethers.getContractFactory('FlashLiquidator');
  // const myContract = await FlashLiquidatorFactory.attach("0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690");

  // Setup all token contracts with accounts
  contractsDictAcct1 = createContractsDict(account1);
  contractsDictAcct2 = createContractsDict(account2);

  // deploy flashloan Borrower contract
  const myContract = await FlashLiquidatorFactory.deploy(
    contractsDictAcct1.joetroller.address,
    contractsDictAcct1.joerouter.address
  );
  await myContract.deployed();
  console.log("Flash Loan liquidator contract deployed to:", myContract.address);


  supplyContracts = {
    "name"    : "WBTC",
    "token"   : contractsDictAcct2.WBTC,
    "jToken"  : contractsDictAcct2.jWBTC,
    "jErc"    : contractsDictAcct2.WBTCjErc20
  };
  
  borrowContracts = {
    "name"    : "USDC",
    "token"   : contractsDictAcct2.USDC,
    "jToken"  : contractsDictAcct2.jUSDC,
    "jErc"    : contractsDictAcct2.USDCjErc20
  };
  
  repayContracts = {
    "name"    : "USDC",
    "token"   : contractsDictAcct1.USDC,
    "jToken"  : contractsDictAcct1.jUSDC,
    "jErc"    : contractsDictAcct1.USDCjErc20
  };

  const borrowedWavaxBool = borrowContracts.token.address == contractsDictAcct1.WAVAX.address;

  if ( !borrowedWavaxBool )
  {
    flashContracts = {
      "name"    : "WAVAX",
      "token"   : contractsDictAcct1.WAVAX,
      "jToken"  : contractsDictAcct1.jWAVAX,
      "jErc"    : contractsDictAcct1.WAVAXjErc20
    };
  }
  else
  {
    flashContracts = {
      "name"    : "DAI",
      "token"   : contractsDictAcct1.DAI,
      "jToken"  : contractsDictAcct1.jDAI,
      "jErc"    : contractsDictAcct1.DAIjErc20
    };
  }

  // --------------------------------------------------
  // First get account 2 underwater
  // --------------------------------------------------

  logger.info("Swapping %d AVAX tokens for Supply(%s) tokens", avaxToSupply, supplyContracts.name);

  const supplyTokenDecimals = await supplyContracts.token.decimals();
  const borrowTokenDecimals = await borrowContracts.token.decimals();
  const repayTokenDecimals = await repayContracts.token.decimals();
  const flashTokenDecimals = await flashContracts.token.decimals();

  const wavaxExp = 1e18;
  const supplyTokenExp = 10 ** supplyTokenDecimals;
  const borrowTokenExp = 10 ** borrowTokenDecimals;
  const repayTokenExp = 10 ** repayTokenDecimals;
  const flashTokenExp = 10 ** flashTokenDecimals;

  // Call this to update block.timestamp on local network
  await ethers.provider.send('evm_mine');

  // Swap for supply token
  avaxAmountOut = BigInt(avaxToSupply * 1e18);
  await swapAvaxForTokens(
    contractsDictAcct2,             // contracts: contractsDict
    supplyContracts.token.address,  // address:   tokenIn
    account2.address,               // address:   to
    avaxAmountOut                   // BigInt:    amount
  );

  supplyAmount = await supplyContracts.token.balanceOf(account2.address);

  logger.info("Done swapping %d AVAX tokens for Supply(%s) tokens amount(%d)", avaxToSupply, supplyContracts.name, supplyAmount / supplyTokenExp);
  await logBalances( LOG_DEBUG, account2.address, supplyContracts, "Supply" );

  // Approve supply collateral token for jToken contract
  tx = await supplyContracts.token.approve(supplyContracts.jToken.address, supplyAmount);
  receipt = await tx.wait();

  logger.info("Lending %s to post as collateral", supplyContracts.name);

  // Mint jToken
  tx = await supplyContracts.jErc.mint(supplyAmount);
  receipt = await tx.wait();

  await logBalances( LOG_DEBUG, account2.address, supplyContracts, "Supply" );

  logger.info("Attempting to enter supplied %s tokens to market", supplyContracts.name);
  
  // Enter jToken to market for collateral
  tx = await contractsDictAcct2.joetroller.enterMarkets( [supplyContracts.jToken.address] );
  receipt = await tx.wait();
  
  // Verify Supplied jToken is entered
  let marketEntered = await contractsDictAcct2.joetroller.checkMembership( account2.address, supplyContracts.jToken.address);
  if ( !marketEntered )  { console.log("Error entering to market"); return; }
  else
    logger.info("j%s jTokens entered market successfully", supplyContracts.name);

  // Get current liquidity of account
  [err, liq, short] = await contractsDictAcct2.joetroller.getAccountLiquidity(account2.address);
  if (err != 0)  { console.log("Error getting liquidity"); return; }

  logger.info("Account 2 Liquidity: %d", liq / 1e18);
  logger.info("Account 2 Shortfall: %d", short / 1e18);
  
  // --------------------------------------------------
  // Account 2 to borrow max
  // --------------------------------------------------

  const decimalCorrection = 18 - borrowTokenDecimals;
  const borrowTokenPrice = await contractsDictAcct2.joeoracle.getUnderlyingPrice(borrowContracts.jErc.address)
  logger.info("Borrow token(%s) Price(%d)", borrowContracts.name, borrowTokenPrice / (1e18 * (10 ** decimalCorrection)));
  
  // Calculate borrow amount
  borrowAmount = ( (liq * 1e18) / borrowTokenPrice );
  const borrowFudge  = 0.999999999999999;
  logger.info("Attempting to borrow token(%s) amount(%d)", borrowContracts.name, Math.trunc(borrowAmount * borrowFudge) / borrowTokenExp);
  
  // Borrow ERC20 token
  tx = await borrowContracts.jErc.borrow( BigInt(Math.trunc(borrowAmount * borrowFudge)) );
  receipt = await tx.wait();
  const borrowErcBalance = await borrowContracts.token.balanceOf(account2.address);
  if (borrowErcBalance == 0)  { console.log("Borrow balance of is 0"); return; }
  else
    logger.info("Successfully borrowed %s", borrowContracts.name);

  await logBalances( LOG_DEBUG, account2.address, borrowContracts, "Borrow" );
  
  // Get liquidity after borrowing
  [err, liq, short] = await contractsDictAcct2.joetroller.getAccountLiquidity(account2.address);
  if (err != 0)
    logger.fatal("Error getting liquidity");

  logger.info("Account 2 Liquidity: %d", liq / 1e18);
  logger.info("Account 2 Shortfall: %d", short / 1e18);

  // Jump ahead in time
  await ethers.provider.send("evm_increaseTime", [60*60*24*1])
  await ethers.provider.send('evm_mine');
  
  // Get current borrow balance after mining
  tx = await borrowContracts.jToken.borrowBalanceCurrent(account2.address);
  receipt = tx.wait();
  borrowTokenBalanceJoe = await borrowContracts.jToken.borrowBalanceStored(account2.address);
  borrowTokenBalanceLocal = await borrowContracts.token.balanceOf(account2.address);

  logger.info("Advanced in time to accrue interest on borrowed %s Token", borrowContracts.name);
  logger.info("Borrow token %s balance stored on Joe: %d", borrowContracts.name, borrowTokenBalanceJoe / borrowTokenExp);
  logger.info("Total interest accrued on %s borrow position: %d", borrowContracts.name, (borrowTokenBalanceJoe - borrowTokenBalanceLocal) / borrowTokenExp);
  
  // Get liquidity now that there should be shortfall on the account
  [err, liq, short] = await contractsDictAcct2.joetroller.getAccountLiquidity(account2.address);
  if (err != 0)  { console.log("Error getting liquidity"); return; }
  if (short == 0)  { console.log("Account is not underwater yet"); return; }

  logger.info("Account 2 Liquidity: %d", liq / 1e18);
  logger.info("Account 2 Shortfall: %d", short / 1e18);

  // --------------------------------------------------
  // Now liquidate underwater Account 2 using flashloan
  // --------------------------------------------------

  // // Send 1 AVAX to contract for gas
  // const transactionHash = await account1.sendTransaction({
  //   to: myContract.address,
  //   value: ethers.utils.parseEther("2.0"), // Sends exactly 1.0 ether
  // });

  initialAvaxAccount1 = await hre.ethers.provider.getBalance(account1.address);

  // Calculate repay amount
  const closeFactor = await contractsDictAcct1.joetroller.closeFactorMantissa();
  let repayAmountBorrowed = (borrowTokenBalanceJoe * closeFactor) / 1e18;

  const [repayAmount, temp] = await contractsDictAcct1.joerouter.getAmountsIn(
    BigInt(Math.trunc(repayAmountBorrowed)),
    [ flashContracts.token.address, repayContracts.token.address ]
  );

  logger.info("Calculated %s repay amount %d", repayContracts.name, Math.trunc(repayAmountBorrowed) / repayTokenExp);
  logger.info("Calculated %s repay amount %d", flashContracts.name, repayAmount / flashTokenExp);

  logger.info("Starting Liquidation");
  const txFlash = await myContract.doFlashloan(
    flashContracts.jToken.address,      // address: flashloanLender
    flashContracts.token.address,       // address: flashLoanToken
    repayAmount,                        // uint256: flashLoanAmount
    account2.address,                   // address: borrowerToLiquidate
    borrowContracts.jToken.address,     // address: jTokenBorrowed
    borrowContracts.token.address,      // address: jTokenBorrowedUnderlying
    supplyContracts.jToken.address,     // address: jTokenSupplied
    supplyContracts.token.address       // address: jTokenSuppliedUnderlying
  )
  logger.info("Finished liquidation");

  // --------------------------------------------------
  // Calculate totals and profits
  // --------------------------------------------------
  const flashTokenProfit = await flashContracts.token.balanceOf(account1.address);

  if ( borrowedWavaxBool )
  {
    await swapTokensForAvax(
      contractsDictAcct1,           // dict:      contractsDict
      flashContracts.token,         // dict:      tokenIn
      account1.address,             // address:   to
      flashTokenProfit              // BigInt:    amount
    );
  }
  else
  {
    const wavaxProfit = await contractsDictAcct1.WAVAX.balanceOf(account1.address);
    tx = await contractsDictAcct1.WAVAX.withdraw(wavaxProfit);
    receipt = tx.wait();
  }
  
  const totalAvax  = await hre.ethers.provider.getBalance(account1.address);
  const profitAvax = totalAvax - initialAvaxAccount1;

  logger.info("Total AVAX after liquidation: %d", totalAvax / wavaxExp);
  logger.info("AVAX profit after gas: %d", profitAvax / wavaxExp);

  const priceWavax = await contractsDictAcct1.joeoracle.getUnderlyingPrice(contractsDictAcct1.jWAVAX.address);
  logger.info("Profit in USD: %d", (priceWavax * profitAvax) / (wavaxExp ** 2) );

  await new Promise(resolve => setTimeout(resolve, 1000));  // wait for all logs to finish
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


async function logBalances( level, address, contracts, type) {

  logger.debug(" ------------  %s Balances:  ------------", type);
  logger.debug(" Address: %s", address);
  
  const tokenDecimals = await contracts.token.decimals();
  const jTokenDecimals = await contracts.jToken.decimals();
  
  const avaxBal   = await hre.ethers.provider.getBalance(address) / 1e18;
  const tokenBal  = await contracts.token.balanceOf(address) / (10 ** tokenDecimals);
  const jTokenBal = await contracts.jToken.balanceOf(address) / (10 ** jTokenDecimals);
  
  switch(level) {
    case LOG_TRACE:
      logger.trace(" AVAX   Token  balance : %d", avaxBal);
      logger.trace(" %s Token  %s balance : %d", type, contracts.name, tokenBal);
      logger.trace(" %s jToken %s balance : %d", type, contracts.name, jTokenBal);
      break;
      case LOG_DEBUG:
        logger.debug(" AVAX   Token  balance : %d", avaxBal);
        logger.debug(" %s Token  %s balance : %d", type, contracts.name, tokenBal);
        logger.debug(" %s jToken %s balance : %d", type, contracts.name, jTokenBal);
      break;
      case LOG_INFO:
      logger.info(" AVAX   Token  balance : %d", avaxBal);
      logger.info(" %s Token  %s balance : %d", type, contracts.name, tokenBal);
      logger.info(" %s jToken %s balance : %d", type, contracts.name, jTokenBal);
      break;
  }
}