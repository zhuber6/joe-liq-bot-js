const { time } = require("@openzeppelin/test-helpers");
util = require('util');
joetrollerAbi   = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/Joetroller.json');
joeOracleAbi    = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/PriceOracle.json');
jTokenAbi       = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/IJToken.json');
jErc20Abi       = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/IJErc20.json');
erc20Abi        = require('../artifacts/contracts/Interfaces/EIP20Interface.sol/EIP20Interface.json');
joeRouterAbi    = require('../artifacts/contracts/Interfaces/IJoeRouter02.sol/IJoeRouter02.json');

const main = async () => {

  let tx;
  let receipt;
  let price;
  let wavaxToken;
  let supplyToken;
  let supplyjToken;
  let borrowAmount;
  let borrowErcBalance;
  let borrowjTokenBalance;

  let block;
  let blockObj;
  let timestamp;

  // The address that has WAVAX on mainnet
  const whaleAddress = '0xB9F79Fc4B7A2F5fB33493aB5D018dB811c9c2f02'
  
  // Become whale
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whaleAddress]
  });

  // get whale wallet as signer
  const whaleWallet  = await hre.ethers.provider.getSigner(whaleAddress);
  const FlashloanBorrowerFactory = await hre.ethers.getContractFactory('FlashloanBorrower');

  // Setup all contracts with whale wallet as signer
  whaleContracts = createContractsDict(whaleWallet);
  
  // deploy flashloan Borrower contract
  const myContract = await FlashloanBorrowerFactory.deploy(whaleContracts.joetroller.address);
  await myContract.deployed();
  const myContractWallet  = await hre.ethers.provider.getSigner(myContract.address);
  console.log("Contract deployed to:", myContract.address);

  // Send 10 WAVAX to flash loan Borrower contract
  tx = await whaleContracts.WAVAX.transfer(myContract.address, BigInt(10 * 1e18))

  // Set contracts for testing
  supplyTokenContract   = whaleContracts.WBTC;
  supplyjTokenContract  = whaleContracts.jWBTC;
  supplyjErcContract    = whaleContracts.WBTCjErc20;
  borrowErcContract     = whaleContracts.DAI;
  borrowjErcContract    = whaleContracts.DAIjErc20;
  borrowjTokenContract  = whaleContracts.jDAI;
  
  // Get initial test token balance
  wavaxToken  = await whaleContracts.WAVAX.balanceOf(whaleAddress);
  supplyToken = await supplyTokenContract.balanceOf(whaleAddress);
  console.log("Before Swap WAVAX:", wavaxToken / 1e18);
  console.log("Before Swap Supply Token:", supplyToken / 1e18);

  // Assign arguments for swap token
  pathWavaxToToken = [ whaleContracts.WAVAX.address, supplyTokenContract.address ];
  block     = await web3.eth.getBlockNumber();
  blockObj  = await web3.eth.getBlock(block);
  timestamp = blockObj.timestamp;

  wavaxAmountOut = BigInt(5 * 1e18);
  
  // Swap AVAX for Test ERC token
  tx = await whaleContracts.WAVAX.approve(whaleContracts.joerouter.address, wavaxAmountOut);
  receipt = await tx.wait();
  tx = await whaleContracts.joerouter.swapExactTokensForTokens(
    wavaxAmountOut,
    BigInt(0),
    pathWavaxToToken,
    whaleAddress,
    BigInt(timestamp + 60)
  )
  receipt = await tx.wait();
  
  // Get post swap balances
  wavaxToken  = await whaleContracts.WAVAX.balanceOf(whaleAddress);
  supplyToken = await supplyTokenContract.balanceOf(whaleAddress);
  console.log("After Swap WAVAX:", wavaxToken / 1e18);
  console.log("After Swap Supply Token:", supplyToken / 1e18);

  // Set supply amount
  supplyAmount = supplyToken;

  // Approve supply collateral token for jToken contract
  tx = await supplyTokenContract.approve(supplyjTokenContract.address, supplyAmount)
  receipt = await tx.wait();

  // Mint jToken
  tx = await supplyjErcContract.mint(supplyAmount);
  receipt = await tx.wait();
  
  // Get current balances
  supplyToken  = await supplyTokenContract.balanceOf(whaleAddress);
  supplyjToken = await supplyjTokenContract.balanceOf(whaleAddress);
  console.log("Current supply token balance:", supplyToken / 1e18);
  console.log("Amount supplied:", supplyAmount / 1e18);
  console.log("Amount minted:", supplyjToken / 1e18);
  
  // Enter jToken to market for collateral
  tx = await whaleContracts.joetroller.enterMarkets( [supplyjTokenContract.address] );
  receipt = await tx.wait();
  
  // Verify Supplied jToken is entered
  let marketEntered = await whaleContracts.joetroller.checkMembership( whaleAddress, supplyjTokenContract.address);
  console.log("We entered market:", marketEntered.toString());
  
  // Verify Supplied jToken is entered
  [err, liq, short] = await whaleContracts.joetroller.getAccountLiquidity(whaleAddress);
  console.log("err:", err.toString(), "liq:", liq / 1e18, "short:", short.toString());
  
  price = await whaleContracts.joeoracle.getUnderlyingPrice(borrowjErcContract.address)
  console.log( "Price of borrow token:", price / 1e18);
  
  // Calculate borrow amount
  borrowAmount = ( (liq * 1e18) / price );
  borrowFudge  = 0.999999999999999;
  
  // Borrow ERC20 token
  tx = await borrowjErcContract.borrow( BigInt(borrowAmount * borrowFudge) );
  receipt = await tx.wait();
  borrowErcBalance = await borrowErcContract.balanceOf(whaleAddress);
  console.log( "Total borrowed amount of DAI:", borrowErcBalance / 1e18);
  if (borrowErcBalance == 0)
    return;
  
  // Get liq after borrowing
  [err, liq, short] = await whaleContracts.joetroller.getAccountLiquidity(whaleAddress);
  console.log("err:", err.toString(), "liq:", liq / 1e18, "short:", short / 1e18);

  // Get current borrow balance
  tx = await supplyjTokenContract.borrowBalanceCurrent(whaleAddress);
  receipt = tx.wait();
  borrowjTokenBalance = await borrowjTokenContract.borrowBalanceStored(whaleAddress);
  console.log("Current jToken borrow balance BEFORE:", borrowjTokenBalance / 1e18);
  
  // Jump ahead in time
  await ethers.provider.send("evm_increaseTime", [60*60*24*100000]) // add 10 seconds
  await ethers.provider.send('evm_mine');

  // Get current borrow balance after mining
  tx = await supplyjTokenContract.borrowBalanceCurrent(whaleAddress);
  receipt = tx.wait();
  borrowjTokenBalance = await borrowjTokenContract.borrowBalanceStored(whaleAddress);
  console.log("Current jToken borrow balance AFTER:", borrowjTokenBalance / 1e18);
  
  // Verify Supplied jToken is entered
  [err, liq, short] = await whaleContracts.joetroller.getAccountLiquidity(whaleAddress);
  console.log("err:", err.toString(), "liq:", liq / 1e18, "short:", short / 1e18);

  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [whaleAddress]
  });

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

// mine blocks
  // const block = await web3.eth.getBlockNumber();
  // await time.advanceBlockTo(block + 1000);

// send ether to the contract
  // const transactionHash = await wallet.sendTransaction({
  //   to: myContract.address,
  //   value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
  // });

function createContractsDict( signerWallet )  {
  var address = {};
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
  WETHjErc20Contract  = new ethers.Contract("0x929f5caB61DFEc79a5431a7734a68D714C4633fa", jErc20Abi.abi, signerWallet);
  WBTCjErc20Contract  = new ethers.Contract("0x3fE38b7b610C0ACD10296fEf69d9b18eB7a9eB1F", jErc20Abi.abi, signerWallet);
  USDCjErc20Contract  = new ethers.Contract("0xEd6AaF91a2B084bd594DBd1245be3691F9f637aC", jErc20Abi.abi, signerWallet);
  USDTjErc20Contract  = new ethers.Contract("0x8b650e26404AC6837539ca96812f0123601E4448", jErc20Abi.abi, signerWallet);
  DAIjErc20Contract   = new ethers.Contract("0xc988c170d0E38197DC634A45bF00169C7Aa7CA19", jErc20Abi.abi, signerWallet);
  LINKjErc20Contract  = new ethers.Contract("0x585E7bC75089eD111b656faA7aeb1104F5b96c15", jErc20Abi.abi, signerWallet);
  MIMjErc20Contract   = new ethers.Contract("0xcE095A9657A02025081E0607c8D8b081c76A75ea", jErc20Abi.abi, signerWallet);

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
  contracts["WETHjErc20"]   = WETHjErc20Contract;
  contracts["WBTCjErc20"]   = WBTCjErc20Contract;
  contracts["USDCjErc20"]   = USDCjErc20Contract;
  contracts["USDTjErc20"]   = USDTjErc20Contract;
  contracts["DAIjErc20"]    = DAIjErc20Contract;
  contracts["LINKjErc20"]   = LINKjErc20Contract;
  contracts["MIMjErc20"]    = MIMjErc20Contract;

  return contracts;
}