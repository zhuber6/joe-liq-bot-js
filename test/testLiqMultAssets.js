const { time, snapshot } = require("@openzeppelin/test-helpers");
util = require('util');

const { network, ethers } = require("hardhat");
const { expect } = require("chai");

const {createContractsDict} = require('../common/contractsDict.js');
const { swapAvaxForTokens, swapTokensForAvax } = require('../common/functions.js');

const pino = require('pino');
const pretty = require('pino-pretty');
const stream = pretty({
  colorize: true
});
const logger = pino(stream);

describe("testLiqMultAsset", async function () {
  beforeEach(async function() {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: "https://api.avax.network/ext/bc/C/rpc",
            chainId: 43114,
            blockNumber: 12580000,
          },
        },
      ],
    });
  });
  await it("Should have a positive profit after liquidation", async function () {

  logger.level = 'info';

  let tx;
  let receipt;

  const avaxToSupply = 100;

  // get wallets as signer
  const [account1, account2] = await ethers.getSigners();
  const FlashLiquidatorFactory = await ethers.getContractFactory('FlashLiquidator');
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


  // const supplyContracts
  const supplyContracts = 
  [{
    "name"    : "USDC",
    "weight"  : 0.5,
    "token"   : contractsDictAcct2.USDC,
    "jToken"  : contractsDictAcct2.jUSDC,
    "jErc"    : contractsDictAcct2.USDCjErc20
  },
  {
    "name"    : "WBTC",
    "weight"  : 0.5,
    "token"   : contractsDictAcct2.WBTC,
    "jToken"  : contractsDictAcct2.jWBTC,
    "jErc"    : contractsDictAcct2.WBTCjErc20
  }]
  
  borrowContracts = 
  [{
    "name"    : "LINK",
    "weight"  : 0.4,
    "token"   : contractsDictAcct2.LINK,
    "jToken"  : contractsDictAcct2.jLINK,
    "jErc"    : contractsDictAcct2.LINKjErc20
  },
  {
    "name"    : "WETH",
    "weight"  : 0.4,
    "token"   : contractsDictAcct2.WETH,
    "jToken"  : contractsDictAcct2.jWETH,
    "jErc"    : contractsDictAcct2.WETHjErc20
  },
  {
    "name"    : "DAI",
    "weight"  : 0.2,
    "token"   : contractsDictAcct2.DAI,
    "jToken"  : contractsDictAcct2.jDAI,
    "jErc"    : contractsDictAcct2.DAIjErc20
  }]
  
  flashContracts = {
    "name"    : "WAVAX",
    "token"   : contractsDictAcct1.WAVAX,
    "jToken"  : contractsDictAcct1.jWAVAX,
    "jErc"    : contractsDictAcct1.WAVAXjErc20
  };

  // --------------------------------------------------
  // Initial setup
  // --------------------------------------------------

  const supplyTokenExp = [supplyContracts.length];
  const supplyTokenDecimals = [];
  supplyContracts.forEach(async (contract, index) => {
    supplyTokenDecimals[index] = await contract.token.decimals();
    supplyTokenExp[index] = 10 ** supplyTokenDecimals[index];
  });

  const borrowTokenExp = [borrowContracts.length];
  const borrowTokenDecimals = [];
  borrowContracts.forEach(async (contract, index) => {
    borrowTokenDecimals[index] = await contract.token.decimals();
    borrowTokenExp[index] = 10 ** borrowTokenDecimals[index];
  });

  const wavaxExp = 1e18;
  const flashTokenDecimals = await flashContracts.token.decimals();
  const flashTokenExp = 10 ** flashTokenDecimals;

  // Call this to update block.timestamp on local network
  await ethers.provider.send('evm_mine');

  // --------------------------------------------------
  // Account 2 to swap test AVAX for supply tokens
  // --------------------------------------------------

  const supplyAmount = [];
  await Promise.all(supplyContracts.map(async (contracts, index) => {
    avaxAmountOut = avaxToSupply * 1e18 * contracts.weight;
    logger.info("Swapping %d AVAX tokens for Supply(%s) tokens", avaxAmountOut / wavaxExp, supplyContracts[index].name);
    await swapAvaxForTokens(
      contractsDictAcct2,             // contracts: contractsDict
      contracts.token.address,        // address:   tokenIn
      account2.address,               // address:   to
      BigInt(avaxAmountOut)           // BigInt:    amount
    );
    supplyAmount[index] = await contracts.token.balanceOf(account2.address);
    logger.info("Done swapping %d AVAX tokens for Supply(%s) tokens amount(%d)",
    avaxAmountOut / wavaxExp, supplyContracts[index].name, supplyAmount[index] / supplyTokenExp[index]);
  }));

  // --------------------------------------------------
  // Account 2 to supply assets
  // --------------------------------------------------

  await Promise.all(supplyContracts.map(async (contracts, index) => {
    tx = await contracts.token.approve(contracts.jToken.address, supplyAmount[index]);
    receipt = await tx.wait();
    
    logger.info("Lending %s to post as collateral", contracts.name);
    
    // Mint jToken
    tx = await contracts.jErc.mint(supplyAmount[index]);
    receipt = await tx.wait();
    
    await logBalances( account2.address, contracts, "Supply" );
    
    logger.info("Attempting to enter supplied %s tokens to market", contracts.name);
    
    // Enter jToken to market for collateral
    tx = await contractsDictAcct2.joetroller.enterMarkets( [contracts.jToken.address] );
    receipt = await tx.wait();
    
    // Verify Supplied jToken is entered
    let marketEntered = await contractsDictAcct2.joetroller.checkMembership( account2.address, contracts.jToken.address);
    expect(marketEntered).to.be.true;
    logger.info("j%s jTokens entered market successfully", contracts.name);
  }));
  
  // Get current liquidity of account
  [err, liq, short] = await contractsDictAcct2.joetroller.getAccountLiquidity(account2.address);
  expect(err.toNumber()).to.equal(0);
  
  logger.info("Account 2 Liquidity: %d", liq / 1e18);
  logger.info("Account 2 Shortfall: %d", short / 1e18);
  
  // --------------------------------------------------
  // Account 2 to borrow max
  // --------------------------------------------------

  // Force borrows to happen sequentially or will see inconsistent behavior
  var weightSum = 0;
  for (let i = 0; i < borrowContracts.length; i++) {
    weightSum += borrowContracts[i].weight;
    await borrow(
      account2,
      borrowContracts[i],
      borrowTokenExp[i],
      borrowTokenDecimals[i],
      contractsDictAcct2,
      weightSum,
      liq
    );
  }

  // --------------------------------------------------
  // Jump ahead in time to force account 2 underwater
  // --------------------------------------------------

  await ethers.provider.send("evm_increaseTime", [60*60*24*365])
  await ethers.provider.send('evm_mine');

  // Get current borrow balance after mining. Triggers interest to accrue
  borrowTokenBalanceJoe = [borrowContracts.length];
  for (let i = 0; i < borrowContracts.length; i++) {
    tx = await borrowContracts[i].jToken.borrowBalanceCurrent(account2.address);
    receipt = tx.wait();
    borrowTokenBalanceJoe[i] = await borrowContracts[i].jToken.borrowBalanceStored(account2.address);
  }

  // Get liquidity now that there should be shortfall on the account
  [err, liq, short] = await contractsDictAcct2.joetroller.getAccountLiquidity(account2.address);
  logger.info("Account 2 Liquidity: %d", liq / 1e18);
  logger.info("Account 2 Shortfall: %d", short / 1e18);
  expect(err.toNumber()).to.equal(0);
  expect(short / 1e18).to.gt(0);
  
  // Get account supplies and borrow positions
  const priceSupply = [supplyContracts.length];
  const supplyUSD = [supplyContracts.length];
  
  const priceBorrow = [borrowContracts.length];
  const borrowUSD = [borrowContracts.length];

  for (let i = 0; i < supplyContracts.length; i++) {
    priceSupply[i] = await contractsDictAcct2.joeoracle.getUnderlyingPrice(supplyContracts[i].jToken.address);
    supplyUSD[i] = priceSupply[i] * supplyAmount[i] / 1e36;
  }
  
  for (let i = 0; i < borrowContracts.length; i++) {
    priceBorrow[i] = await contractsDictAcct2.joeoracle.getUnderlyingPrice(borrowContracts[i].jToken.address);
    borrowUSD[i] = priceBorrow[i] * borrowTokenBalanceJoe[i] / 1e36;
  }
  
  // Find max supply and borrow positions
  const maxSupplyIndex = supplyUSD.indexOf(Math.max(...supplyUSD));
  const maxBorrowIndex = borrowUSD.indexOf(Math.max(...borrowUSD));
  
  logger.info("max supply USD: %d %s", supplyUSD[maxSupplyIndex], supplyContracts[maxSupplyIndex].name);
  logger.info("max borrow USD: %d %s", borrowUSD[maxBorrowIndex], borrowContracts[maxBorrowIndex].name);

  const closeFactor = await contractsDictAcct1.joetroller.closeFactorMantissa();
  expect(supplyUSD[maxSupplyIndex]).to.gt(borrowUSD[maxBorrowIndex] * closeFactor / 1e18);

  // --------------------------------------------------
  // Now liquidate underwater Account 2 using flashloan
  // --------------------------------------------------

  const borrowedWavaxBool = borrowContracts[maxBorrowIndex].token.address == contractsDictAcct1.WAVAX.address;
  if ( borrowedWavaxBool )
  {
    flashContracts = {
      "name"    : "DAI",
      "token"   : contractsDictAcct1.DAI,
      "jToken"  : contractsDictAcct1.jDAI,
      "jErc"    : contractsDictAcct1.DAIjErc20
    };
  }

  // Calculate repay amount
  const repayAmountBorrowed = (borrowTokenBalanceJoe[maxBorrowIndex] * closeFactor) / 1e18;

  const [repayAmount, temp] = await contractsDictAcct1.joerouter.getAmountsIn(
    BigInt(Math.trunc(repayAmountBorrowed)),
    [ flashContracts.token.address, borrowContracts[maxBorrowIndex].token.address ]
  );

  logger.info("Calculated %s repay amount %d", borrowContracts[maxBorrowIndex].name, Math.trunc(repayAmountBorrowed) / borrowTokenExp[maxBorrowIndex]);
  logger.info("Calculated %s repay amount %d", flashContracts.name, repayAmount / flashTokenExp);

  // Get initial AVAX before liquidation
  initialAvaxAccount1 = await ethers.provider.getBalance(account1.address);

  logger.info("Starting Liquidation");
  const txFlash = await myContract.doFlashloan(
    flashContracts.jToken.address,      // address: flashloanLender
    flashContracts.token.address,       // address: flashLoanToken
    account2.address,                   // address: borrowerToLiquidate
    borrowContracts[maxBorrowIndex].jToken.address,  // address: jTokenBorrowed
    borrowContracts[maxBorrowIndex].token.address,   // address: jTokenBorrowedUnderlying
    supplyContracts[maxSupplyIndex].jToken.address,  // address: jTokenSupplied
    supplyContracts[maxSupplyIndex].token.address    // address: jTokenSuppliedUnderlying
  );
  logger.info("Finished liquidation");

  // Get liquidity now that there should be shortfall on the account
  [err, liq, short] = await contractsDictAcct2.joetroller.getAccountLiquidity(account2.address);
  logger.info("Account 2 Liquidity: %d", liq / 1e18);
  logger.info("Account 2 Shortfall: %d", short / 1e18);

  // --------------------------------------------------
  // Calculate totals and profits
  // --------------------------------------------------
  const flashTokenProfit = await flashContracts.token.balanceOf(account1.address);
  expect(flashTokenProfit / flashTokenExp).to.gt(0);

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
  
  const totalAvax  = await ethers.provider.getBalance(account1.address);
  const profitAvax = totalAvax - initialAvaxAccount1;

  logger.info("Total AVAX after liquidation: %d", totalAvax / wavaxExp);
  logger.info("AVAX profit after gas: %d", profitAvax / wavaxExp);

  const priceWavax = await contractsDictAcct1.joeoracle.getUnderlyingPrice(contractsDictAcct1.jWAVAX.address);
  const profitUSD = (priceWavax * profitAvax) / (wavaxExp ** 2);
  logger.info("Profit in USD: %d", profitUSD );

  await new Promise(resolve => setTimeout(resolve, 1000));  // wait for all logs to finish
}).timeout(200000) });

// const runMain = async () => {
//   try {
//     await main();
//     process.exit(0);
//   } catch (error) {
//     console.log(error);
//     process.exit(1);
//   }
// };

// runMain();

async function borrow( account, borrowContracts, exp, decimals, contractsDict, weight, initialLiq ) {
  const decimalCorrection = 18 - decimals;
  const borrowTokenPrice = await contractsDict.joeoracle.getUnderlyingPrice(borrowContracts.jErc.address)
  logger.info("Borrow token(%s) Price(%d)", borrowContracts.name, borrowTokenPrice / (1e18 * (10 ** decimalCorrection)));
  
  // Calculate borrow amount
  const borrowAmount = ( (initialLiq * 1e18) / borrowTokenPrice ) * weight;
  const borrowFudge  = 0.999999999999999;
  logger.info("Attempting to borrow token(%s) amount(%d)", borrowContracts.name, Math.trunc(borrowAmount * borrowFudge) / exp);

  // Borrow ERC20 token
  tx = await borrowContracts.jErc.borrow( BigInt(Math.trunc(borrowAmount * borrowFudge)) );
  receipt = await tx.wait();
  const borrowErcBalance = await borrowContracts.token.balanceOf(account.address);
  expect(borrowErcBalance / exp).to.gt(0);
  logger.info("Successfully borrowed %s", borrowContracts.name);

  await logBalances( account.address, borrowContracts, "Borrow" );

  borrowTokenBalanceJoe = await borrowContracts.jToken.borrowBalanceStored(account.address);
  
  // Get liquidity after borrowing
  [err, liq, short] = await contractsDict.joetroller.getAccountLiquidity(account.address);
  expect(err.toNumber()).to.equal(0);

  logger.info("Account Liquidity: %d", liq / 1e18);
  logger.info("Account Shortfall: %d", short / 1e18);
}


async function logBalances( address, contracts, type) {

  logger.debug(" ------------  %s Balances:  ------------", type);
  logger.debug(" Address: %s", address);

  const avaxBal   = await ethers.provider.getBalance(address) / 1e18;
  logger.debug(" AVAX   Token  balance : %d", avaxBal);

  const tokenDecimals = await contracts.token.decimals();
  const jTokenDecimals = await contracts.jToken.decimals();
  
  const tokenBal  = await contracts.token.balanceOf(address) / (10 ** tokenDecimals);
  const jTokenBal = await contracts.jToken.balanceOf(address) / (10 ** jTokenDecimals);
  
  logger.debug(" %s Token  %s balance : %d", type, contracts.name, tokenBal);
  logger.debug(" %s jToken %s balance : %d", type, contracts.name, jTokenBal);
}