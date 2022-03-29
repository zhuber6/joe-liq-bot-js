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

const LOG_TRACE = 0;
const LOG_DEBUG = 1;
const LOG_INFO  = 2;
const LOG_WARN  = 3;
const LOG_ERROR = 4;
const LOG_FATAL = 5;

describe("testLiqBorrow", async function () {
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

  logger.level = 'info'

  let tx;
  let receipt;
  let borrowAmount;

  const avaxToSupply = 100;

  // get wallets as signer
  const [account1, account2] = await ethers.getSigners();

  // Setup all token contracts with accounts
  contractsDictAcct1 = createContractsDict(account1);
  contractsDictAcct2 = createContractsDict(account2);

  supplyContracts = {
    "name"    : "WETH",
    "token"   : contractsDictAcct2.WETH,
    "jToken"  : contractsDictAcct2.jWETH,
    "jErc"    : contractsDictAcct2.WETHjErc20
  };
  
  borrowContracts = {
    "name"    : "WBTC",
    "token"   : contractsDictAcct2.WBTC,
    "jToken"  : contractsDictAcct2.jWBTC,
    "jErc"    : contractsDictAcct2.WBTCjErc20
  };
  
  repayContracts = {
    "name"    : "WBTC",
    "token"   : contractsDictAcct1.WBTC,
    "jToken"  : contractsDictAcct1.jWBTC,
    "jErc"    : contractsDictAcct1.WBTCjErc20
  };
  
  seizeContracts = {
    "name"    : "WETH",
    "token"   : contractsDictAcct1.WETH,
    "jToken"  : contractsDictAcct1.jWETH,
    "jErc"    : contractsDictAcct1.WETHjErc20
  };

  // --------------------------------------------------
  // First get account 2 underwater
  // --------------------------------------------------

  logger.info("Swapping %d AVAX tokens for Supply(%s) tokens", avaxToSupply, supplyContracts.name);

  const supplyTokenDecimals = await supplyContracts.token.decimals();
  const borrowTokenDecimals = await borrowContracts.token.decimals();
  const repayTokenDecimals = await repayContracts.token.decimals();
  const seizeTokenDecimals = await seizeContracts.token.decimals();

  const wavaxExp = 1e18;
  const supplyTokenExp = 10 ** supplyTokenDecimals;
  const borrowTokenExp = 10 ** borrowTokenDecimals;
  const repayTokenExp = 10 ** repayTokenDecimals;
  const seizeTokenExp = 10 ** seizeTokenDecimals;

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
  await logBalances( account2.address, supplyContracts, "Supply" );

  // Approve supply collateral token for jToken contract
  tx = await supplyContracts.token.approve(supplyContracts.jToken.address, supplyAmount);
  receipt = await tx.wait();

  logger.info("Lending %s to post as collateral", supplyContracts.name);

  // Mint jToken
  tx = await supplyContracts.jErc.mint(supplyAmount);
  receipt = await tx.wait();

  await logBalances( account2.address, supplyContracts, "Supply" );

  logger.info("Attempting to enter supplied %s tokens to market", supplyContracts.name);
  
  // Enter jToken to market for collateral
  tx = await contractsDictAcct2.joetroller.enterMarkets( [supplyContracts.jToken.address] );
  receipt = await tx.wait();
  
  // Verify Supplied jToken is entered
  let marketEntered = await contractsDictAcct2.joetroller.checkMembership( account2.address, supplyContracts.jToken.address);
  expect(marketEntered).to.be.true;

  // Get current liquidity of account
  [err, liq, short] = await contractsDictAcct2.joetroller.getAccountLiquidity(account2.address);
  expect(err.toNumber()).to.equal(0);

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
  expect(borrowErcBalance.toNumber()).to.gt(0);
  expect(err.toNumber()).to.equal(0);

  await logBalances( account2.address, borrowContracts, "Borrow" );
  
  // Get liquidity after borrowing
  [err, liq, short] = await contractsDictAcct2.joetroller.getAccountLiquidity(account2.address);
  expect(err.toNumber()).to.equal(0);

  logger.info("Account 2 Liquidity: %d", liq / 1e18);
  logger.info("Account 2 Shortfall: %d", short / 1e18);

  // Jump ahead in time
  await ethers.provider.send("evm_increaseTime", [60*60*24*100])
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
  expect(err.toNumber()).to.equal(0);
  expect(short / 1e18).to.gt(0);

  logger.info("Account 2 Liquidity: %d", liq / 1e18);
  logger.info("Account 2 Shortfall: %d", short / 1e18);

  // --------------------------------------------------
  // Now liquidate underwater Account 2 from Account 1
  // --------------------------------------------------
  
  initialAvaxAccount1 = await ethers.provider.getBalance(account1.address);

  // Calculate repay amount
  const closeFactor = await contractsDictAcct1.joetroller.closeFactorMantissa();
  let repayAmountBorrowed = (borrowTokenBalanceJoe * closeFactor) / 1e18;

  const [repayAmountAvax, temp] = await contractsDictAcct1.joerouter.getAmountsIn(
    BigInt(Math.trunc(repayAmountBorrowed)),
    [ contractsDictAcct1.WAVAX.address, repayContracts.token.address ]
  );

  logger.info("Calculated %s repay amount %d", repayContracts.name, repayAmountBorrowed / repayTokenExp);
  logger.info("Calculated AVAX repay amount %d", repayAmountAvax / wavaxExp);

  logger.info("Swapping %d AVAX for repay token %s", repayAmountAvax / wavaxExp, repayContracts.name);
  await logBalances( account1.address, repayContracts, "Repay" );

  // Swap for supply token
  await swapAvaxForTokens(
    contractsDictAcct1,             // contracts: contractsDict
    repayContracts.token.address,   // address:   tokenIn
    account1.address,               // address:   to
    repayAmountAvax                 // BigInt:    amount
  );

  logger.info("Done swapping %d AVAX for repay token %s", repayAmountAvax / wavaxExp, repayContracts.name);
  await logBalances( account1.address, repayContracts, "Repay" );

  // Make sure repay amount is less than current balance
  const borrowToRepayBal = await repayContracts.token.balanceOf(account1.address);
  expect(borrowToRepayBal / repayTokenExp).to.equal(Math.trunc(repayAmountBorrowed) / repayTokenExp);

  logger.info("Attempting liquidation of Account 2");
  await logBalances( account1.address, seizeContracts, "Seize" );

  // Approve tokens for repayment
  tx = await repayContracts.token.approve(repayContracts.jToken.address, BigInt(Math.trunc(repayAmountBorrowed)));
  receipt = await tx.wait();
  
  // Attempt to liquidate
  tx = await repayContracts.jErc.liquidateBorrow(
    account2.address,
    BigInt(Math.trunc(repayAmountBorrowed)),
    seizeContracts.jToken.address
  );
  receipt = await tx.wait();

  // Verify balance has changed.
  const seizedAmount = await seizeContracts.jToken.balanceOf(account1.address);
  expect(seizedAmount / 1e8).to.gt(0);
  logger.info("Successfully seized jTokens(j%s) amount(%d) from liquidation", seizeContracts.name, seizedAmount / seizeTokenExp);

  await logBalances( account1.address, repayContracts, "Repay" );
  await logBalances( account1.address, seizeContracts, "Seize" );

  // Redeem seized jTokens
  tx = await seizeContracts.jErc.redeem(seizedAmount);
  receipt = await tx.wait();
  
  let seizedUnderlyingBalance = await seizeContracts.token.balanceOf(account1.address);
  logger.info("Redeemed(%d) seized jTokens(j%s) for underlying asset(%s)", seizedUnderlyingBalance / seizeTokenExp, seizeContracts.name, seizeContracts.name);
  await logBalances( account1.address, seizeContracts, "Seize" );

  await swapTokensForAvax(
    contractsDictAcct1,           // dict:      contractsDict
    seizeContracts.token,         // dict:      tokenIn
    account1.address,             // address:   to
    seizedUnderlyingBalance       // BigInt:    amount
  );

  logger.info("Swapped seized tokens for AVAX");
  await logBalances( account1.address, seizeContracts, "Seize" );
  await logBalances( account1.address, repayContracts, "Repay" );

  // --------------------------------------------------
  // Finally calculate totals and profits
  // --------------------------------------------------

  const totalAvax  = await ethers.provider.getBalance(account1.address);
  const profitAvax = totalAvax - initialAvaxAccount1;

  logger.info("Total AVAX after liquidation: %d", totalAvax / wavaxExp);
  logger.info("AVAX profit after gas: %d", profitAvax / wavaxExp);

  const priceWavax = await contractsDictAcct1.joeoracle.getUnderlyingPrice(contractsDictAcct1.jWAVAX.address);
  const profitUSD = (priceWavax * profitAvax) / (wavaxExp ** 2);
  logger.info("Profit in USD: %d", profitUSD);

  expect(profitUSD).to.gt(0);
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