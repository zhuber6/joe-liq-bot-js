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

  logger.level = 'info'

  let tx;
  let receipt;
  let borrowAmount;

  const avaxToSupply = 100;

  // get wallets as signer
  const [account1, account2] = await hre.ethers.getSigners();

  // Setup all token contracts with accounts
  contractsDictAcct1 = createContractsDict(account1);
  contractsDictAcct2 = createContractsDict(account2);

  supplyContracts = {
    "name"    : "WBTC",
    "token"   : contractsDictAcct2.WBTC,
    "jToken"  : contractsDictAcct2.jWBTC,
    "jErc"    : contractsDictAcct2.WBTCjErc20
  };
  
  borrowContracts = {
    "name"    : "USDT",
    "token"   : contractsDictAcct2.USDT,
    "jToken"  : contractsDictAcct2.jUSDT,
    "jErc"    : contractsDictAcct2.USDTjErc20
    // "jErc"    : contractsDictAcct2.WAVAXjNative
  };
  
  repayContracts = {
    "name"    : "USDT",
    "token"   : contractsDictAcct1.USDT,
    "jToken"  : contractsDictAcct1.jUSDT,
    "jErc"    : contractsDictAcct1.USDTjErc20
    // "jErc"    : contractsDictAcct1.WAVAXjNative
  };
  
  seizeContracts = {
    "name"    : "WBTC",
    "token"   : contractsDictAcct1.WBTC,
    "jToken"  : contractsDictAcct1.jWBTC,
    "jErc"    : contractsDictAcct1.WBTCjErc20
  };

  // --------------------------------------------------
  // First get account 2 underwater
  // --------------------------------------------------

  logger.info("Swapping %d AVAX tokens for Supply(%s) tokens", avaxToSupply, supplyContracts.name);

  const supplyTokenDecimals = await supplyContracts.token.decimals();
  const borrowTokenDecimals = await borrowContracts.token.decimals();
  const repayTokenDecimals = await repayContracts.token.decimals();
  const seizeTokenDecimals = await seizeContracts.token.decimals();

  const supplyjTokenDecimals = await supplyContracts.jToken.decimals();
  const borrowjTokenDecimals = await borrowContracts.jToken.decimals();
  const repayjTokenDecimals = await repayContracts.jToken.decimals();
  const seizejTokenDecimals = await seizeContracts.jToken.decimals();

  const wavaxExp = 1e18;
  const supplyTokenExp = 10 ** supplyTokenDecimals;
  const borrowTokenExp = 10 ** borrowTokenDecimals;
  const repayTokenExp = 10 ** repayTokenDecimals;
  const seizeTokenExp = 10 ** seizeTokenDecimals;

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
  // Now liquidate underwater Account 2 from Account 1
  // --------------------------------------------------
  
  initialAvaxAccount1 = await hre.ethers.provider.getBalance(account1.address);

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
  await logBalances( LOG_DEBUG, account1.address, repayContracts, "Repay" );

  // Swap for supply token
  await swapAvaxForTokens(
    contractsDictAcct1,             // contracts: contractsDict
    repayContracts.token.address,   // address:   tokenIn
    account1.address,               // address:   to
    repayAmountAvax                 // BigInt:    amount
  );

  logger.info("Done swapping %d AVAX for repay token %s", repayAmountAvax / wavaxExp, repayContracts.name);
  await logBalances( LOG_DEBUG, account1.address, repayContracts, "Repay" );

  // Make sure repay amount is less than current balance
  const borrowToRepayBal = await repayContracts.token.balanceOf(account1.address);
  if ( borrowToRepayBal != Math.trunc(repayAmountBorrowed) )  {
    console.log("borrowToRepayBal:", borrowToRepayBal / (10 ** borrowTokenDecimals), "repayAmountBorrowed:", repayAmountBorrowed / (10 ** borrowTokenDecimals));
    console.log("Attempting to repay without enough of repay token balance");
    return;
  }

  logger.info("Attempting liquidation of Account 2");
  await logBalances( LOG_DEBUG, account1.address, seizeContracts, "Seize" );

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
  if (seizedAmount == 0)  {
    console.log("Unable to liquidate account, seized assets:", seizedAmount / seizeTokenExp);
    return;
  }
  else
    logger.info("Successfully seized jTokens(j%s) amount(%d) from liquidation", seizeContracts.name, seizedAmount / seizeTokenExp);

  await logBalances( LOG_DEBUG, account1.address, repayContracts, "Repay" );
  await logBalances( LOG_DEBUG, account1.address, seizeContracts, "Seize" );

  // Redeem seized jTokens
  tx = await seizeContracts.jErc.redeem(seizedAmount);
  receipt = await tx.wait();
  
  let seizedUnderlyingBalance = await seizeContracts.token.balanceOf(account1.address);
  logger.info("Redeemed(%d) seized jTokens(j%s) for underlying asset(%s)", seizedUnderlyingBalance / seizeTokenExp, seizeContracts.name, seizeContracts.name);
  await logBalances( LOG_DEBUG, account1.address, seizeContracts, "Seize" );

  await swapTokensForAvax(
    contractsDictAcct1,           // dict:      contractsDict
    seizeContracts.token,         // dict:      tokenIn
    account1.address,             // address:   to
    seizedUnderlyingBalance       // BigInt:    amount
  );

  logger.info("Swapped seized tokens for AVAX");
  await logBalances( LOG_DEBUG, account1.address, seizeContracts, "Seize" );
  await logBalances( LOG_DEBUG, account1.address, repayContracts, "Repay" );

  // --------------------------------------------------
  // Finally calculate totals and profits
  // --------------------------------------------------

  const totalAvax  = await hre.ethers.provider.getBalance(account1.address);
  const profitAvax = totalAvax - initialAvaxAccount1;

  logger.info("Total AVAX after liquidation: %d", totalAvax / wavaxExp);
  logger.info("AVAX profit after gas: %d", profitAvax / wavaxExp);

  const priceWavax = await contractsDictAcct1.joeoracle.getUnderlyingPrice(contractsDictAcct1.jAVAX.address);
  logger.info("Profit in USD: %d", (priceWavax * profitAvax) / (wavaxExp ** 2) );
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


function createContractsDict( signerWallet )  {
  var contracts = {};

  // -----------------------------
  // Create contracts for each token to access
  // -----------------------------

  // Joe Contracts
  joetrollerContract = new ethers.Contract("0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC", joetrollerAbi.abi, signerWallet);
  joeOracleContract  = new ethers.Contract("0xd7Ae651985a871C1BC254748c40Ecc733110BC2E", joeOracleAbi.abi,  signerWallet);
  joeRouterContract  = new ethers.Contract("0x60aE616a2155Ee3d9A68541Ba4544862310933d4", joeRouterAbi.abi,  signerWallet);
  
  // jTokens
  jAVAXContract = new ethers.Contract("0xC22F01ddc8010Ee05574028528614634684EC29e", jTokenAbi.abi, signerWallet);
  jWETHContract = new ethers.Contract("0x929f5caB61DFEc79a5431a7734a68D714C4633fa", jTokenAbi.abi, signerWallet);
  jWBTCContract = new ethers.Contract("0x3fE38b7b610C0ACD10296fEf69d9b18eB7a9eB1F", jTokenAbi.abi, signerWallet);
  jUSDCContract = new ethers.Contract("0xEd6AaF91a2B084bd594DBd1245be3691F9f637aC", jTokenAbi.abi, signerWallet);
  jUSDTContract = new ethers.Contract("0x8b650e26404AC6837539ca96812f0123601E4448", jTokenAbi.abi, signerWallet);
  jDAIContract  = new ethers.Contract("0xc988c170d0E38197DC634A45bF00169C7Aa7CA19", jTokenAbi.abi, signerWallet);
  jLINKContract = new ethers.Contract("0x585E7bC75089eD111b656faA7aeb1104F5b96c15", jTokenAbi.abi, signerWallet);
  jMIMContract  = new ethers.Contract("0xcE095A9657A02025081E0607c8D8b081c76A75ea", jTokenAbi.abi, signerWallet);
  jXJOEContract = new ethers.Contract("0xC146783a59807154F92084f9243eb139D58Da696", jTokenAbi.abi, signerWallet);

  // ERC20 Tokens
  WAVAXContract = new ethers.Contract("0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", erc20Abi.abi, signerWallet);
  WETHContract  = new ethers.Contract("0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab", erc20Abi.abi, signerWallet);
  WBTCContract  = new ethers.Contract("0x50b7545627a5162f82a992c33b87adc75187b218", erc20Abi.abi, signerWallet);
  USDCContract  = new ethers.Contract("0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664", erc20Abi.abi, signerWallet);
  USDTContract  = new ethers.Contract("0xc7198437980c041c805a1edcba50c1ce5db95118", erc20Abi.abi, signerWallet);
  DAIContract   = new ethers.Contract("0xd586e7f844cea2f87f50152665bcbc2c279d8d70", erc20Abi.abi, signerWallet);
  LINKContract  = new ethers.Contract("0x5947bb275c521040051d82396192181b413227a3", erc20Abi.abi, signerWallet);
  MIMContract   = new ethers.Contract("0x130966628846bfd36ff31a822705796e8cb8c18d", erc20Abi.abi, signerWallet);
  
  // jERC20 Tokens
  WAVAXjNativeContract  = new ethers.Contract("0xC22F01ddc8010Ee05574028528614634684EC29e", jWrappedNativeAbi.abi, signerWallet);
  WETHjErc20Contract    = new ethers.Contract("0x929f5caB61DFEc79a5431a7734a68D714C4633fa", jErc20Abi.abi, signerWallet);
  WBTCjErc20Contract    = new ethers.Contract("0x3fE38b7b610C0ACD10296fEf69d9b18eB7a9eB1F", jErc20Abi.abi, signerWallet);
  USDCjErc20Contract    = new ethers.Contract("0xEd6AaF91a2B084bd594DBd1245be3691F9f637aC", jErc20Abi.abi, signerWallet);
  USDTjErc20Contract    = new ethers.Contract("0x8b650e26404AC6837539ca96812f0123601E4448", jErc20Abi.abi, signerWallet);
  DAIjErc20Contract     = new ethers.Contract("0xc988c170d0E38197DC634A45bF00169C7Aa7CA19", jErc20Abi.abi, signerWallet);
  LINKjErc20Contract    = new ethers.Contract("0x585E7bC75089eD111b656faA7aeb1104F5b96c15", jErc20Abi.abi, signerWallet);
  MIMjErc20Contract     = new ethers.Contract("0xcE095A9657A02025081E0607c8D8b081c76A75ea", jErc20Abi.abi, signerWallet);

  // -----------------------------
  // Create contracts dict
  // -----------------------------

  // Joe Core contracts
  contracts["joetroller"]   = joetrollerContract;
  contracts["joeoracle"]    = joeOracleContract;
  contracts["joerouter"]    = joeRouterContract;

  // jTokens
  contracts["jAVAX"]        = jAVAXContract;
  contracts["jWETH"]        = jWETHContract;
  contracts["jWBTC"]        = jWBTCContract;
  contracts["jUSDC"]        = jUSDCContract;
  contracts["jUSDT"]        = jUSDTContract;
  contracts["jDAI"]         = jDAIContract;
  contracts["jLINK"]        = jLINKContract;
  contracts["jMIM"]         = jMIMContract;
  contracts["jXJOE"]        = jXJOEContract;

  // ERC20 Tokens
  contracts["WAVAX"]        = WAVAXContract;
  contracts["WETH"]         = WETHContract;
  contracts["WBTC"]         = WBTCContract;
  contracts["USDC"]         = USDCContract;
  contracts["USDT"]         = USDTContract;
  contracts["DAI"]          = DAIContract;
  contracts["LINK"]         = LINKContract;
  contracts["MIM"]          = MIMContract;

  // jERC20 Tokens
  contracts["WAVAXjNative"] = WAVAXjNativeContract;
  contracts["WETHjErc20"]   = WETHjErc20Contract;
  contracts["WBTCjErc20"]   = WBTCjErc20Contract;
  contracts["USDCjErc20"]   = USDCjErc20Contract;
  contracts["USDTjErc20"]   = USDTjErc20Contract;
  contracts["DAIjErc20"]    = DAIjErc20Contract;
  contracts["LINKjErc20"]   = LINKjErc20Contract;
  contracts["MIMjErc20"]    = MIMjErc20Contract;

  return contracts;
}

async function getCurrentTimestamp()  {
  let block     = await web3.eth.getBlockNumber();
  let blockObj  = await web3.eth.getBlock(block);
  return blockObj.timestamp;
}

async function swapAvaxForTokens( contractsDict, tokenIn, to, amount ) {
  
  // Get timestamp for swap
  let timestamp = await getCurrentTimestamp();

  // Swap AVAX for ERC token
  tx = await contractsDict.WAVAX.approve(contractsDict.joerouter.address, amount);
  receipt = await tx.wait();
  tx = await contractsDict.joerouter.swapExactAVAXForTokens(
    0,
    [ contractsDict.WAVAX.address, tokenIn ],
    to,
    BigInt(timestamp + 60),
    {value: amount}
  )
  receipt = await tx.wait();
}

async function swapTokensForAvax( contractsDict, tokenInContract, to, amount ) {
  
  // Get timestamp for swap
  let timestamp = await getCurrentTimestamp();

  // Swap ERC token for AVAX
  tx = await tokenInContract.approve(contractsDict.joerouter.address, amount);
  receipt = await tx.wait();
  tx = await contractsDict.joerouter.swapExactTokensForAVAX(
    amount,
    0,
    [ tokenInContract.address, contractsDict.WAVAX.address ],
    to,
    BigInt(timestamp + 60)
  )
  receipt = await tx.wait();
}

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