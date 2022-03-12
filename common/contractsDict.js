joetrollerAbi     = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/Joetroller.json');
joeOracleAbi      = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/PriceOracle.json');
jTokenAbi         = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/IJToken.json');
jErc20Abi         = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/IJErc20.json');
erc20Abi          = require('../artifacts/contracts/Interfaces/IERC20.sol/IERC20.json');
wavaxAbi          = require('../artifacts/contracts/Interfaces/IWAVAX.sol/IWAVAX.json');
jWrappedNativeAbi = require('../artifacts/contracts/Interfaces/JoeLendingInterface.sol/IJWrappedNative.json');
joeRouterAbi      = require('../artifacts/contracts/Interfaces/IJoeRouter02.sol/IJoeRouter02.json');

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
  jWAVAXContract= new ethers.Contract("0xC22F01ddc8010Ee05574028528614634684EC29e", jTokenAbi.abi, signerWallet);
  jWETHContract = new ethers.Contract("0x929f5caB61DFEc79a5431a7734a68D714C4633fa", jTokenAbi.abi, signerWallet);
  jWBTCContract = new ethers.Contract("0x3fE38b7b610C0ACD10296fEf69d9b18eB7a9eB1F", jTokenAbi.abi, signerWallet);
  jUSDCContract = new ethers.Contract("0xEd6AaF91a2B084bd594DBd1245be3691F9f637aC", jTokenAbi.abi, signerWallet);
  jUSDTContract = new ethers.Contract("0x8b650e26404AC6837539ca96812f0123601E4448", jTokenAbi.abi, signerWallet);
  jDAIContract  = new ethers.Contract("0xc988c170d0E38197DC634A45bF00169C7Aa7CA19", jTokenAbi.abi, signerWallet);
  jLINKContract = new ethers.Contract("0x585E7bC75089eD111b656faA7aeb1104F5b96c15", jTokenAbi.abi, signerWallet);
  jMIMContract  = new ethers.Contract("0xcE095A9657A02025081E0607c8D8b081c76A75ea", jTokenAbi.abi, signerWallet);
  jXJOEContract = new ethers.Contract("0xC146783a59807154F92084f9243eb139D58Da696", jTokenAbi.abi, signerWallet);

  // ERC20 Tokens
  WAVAXContract = new ethers.Contract("0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", wavaxAbi.abi, signerWallet);
  WETHContract  = new ethers.Contract("0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab", erc20Abi.abi, signerWallet);
  WBTCContract  = new ethers.Contract("0x50b7545627a5162f82a992c33b87adc75187b218", erc20Abi.abi, signerWallet);
  USDCContract  = new ethers.Contract("0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664", erc20Abi.abi, signerWallet);
  USDTContract  = new ethers.Contract("0xc7198437980c041c805a1edcba50c1ce5db95118", erc20Abi.abi, signerWallet);
  DAIContract   = new ethers.Contract("0xd586e7f844cea2f87f50152665bcbc2c279d8d70", erc20Abi.abi, signerWallet);
  LINKContract  = new ethers.Contract("0x5947bb275c521040051d82396192181b413227a3", erc20Abi.abi, signerWallet);
  MIMContract   = new ethers.Contract("0x130966628846bfd36ff31a822705796e8cb8c18d", erc20Abi.abi, signerWallet);
  XJOEContract  = new ethers.Contract("0x57319d41F71E81F3c65F2a47CA4e001EbAFd4F33", erc20Abi.abi, signerWallet);
  
  // jERC20 Tokens
  WAVAXjErc20Contract   = new ethers.Contract("0xC22F01ddc8010Ee05574028528614634684EC29e", jWrappedNativeAbi.abi, signerWallet);
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
  contracts["jWAVAX"]       = jWAVAXContract;
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
  contracts["XJOE"]         = XJOEContract;

  // jERC20 Tokens
  contracts["WAVAXjErc20"]  = WAVAXjErc20Contract;
  contracts["WETHjErc20"]   = WETHjErc20Contract;
  contracts["WBTCjErc20"]   = WBTCjErc20Contract;
  contracts["USDCjErc20"]   = USDCjErc20Contract;
  contracts["USDTjErc20"]   = USDTjErc20Contract;
  contracts["DAIjErc20"]    = DAIjErc20Contract;
  contracts["LINKjErc20"]   = LINKjErc20Contract;
  contracts["MIMjErc20"]    = MIMjErc20Contract;

  return contracts;
}

const WAVAX   = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const WETH    = "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab";
const WBTC    = "0x50b7545627a5162F82A992c33b87aDc75187B218";
const USDC    = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";
const USDT    = "0xc7198437980c041c805A1EDcbA50c1Ce5db95118";
const DAI     = "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70";
const LINK    = "0x5947BB275c521040051D82396192181b413227A3";
const MIM     = "0x130966628846BFd36ff31a822705796e8cb8C18D";
const XJOE    = "0x57319d41F71E81F3c65F2a47CA4e001EbAFd4F33";

const jWAVAX  = "0xC22F01ddc8010Ee05574028528614634684EC29e";
const jWETH   = "0x929f5caB61DFEc79a5431a7734a68D714C4633fa";
const jWBTC   = "0x3fE38b7b610C0ACD10296fEf69d9b18eB7a9eB1F";
const jUSDC   = "0xEd6AaF91a2B084bd594DBd1245be3691F9f637aC";
const jUSDT   = "0x8b650e26404AC6837539ca96812f0123601E4448";
const jDAI    = "0xc988c170d0E38197DC634A45bF00169C7Aa7CA19";
const jLINK   = "0x585E7bC75089eD111b656faA7aeb1104F5b96c15";
const jMIM    = "0xcE095A9657A02025081E0607c8D8b081c76A75ea";
const jXJOE   = "0xC146783a59807154F92084f9243eb139D58Da696";

const joeToErc20Dict = {
  [jWAVAX] : WAVAX,
  [jWETH] : WETH,
  [jWBTC] : WBTC,
  [jUSDC] : USDC,
  [jUSDT] : USDT,
  [jDAI] : DAI,
  [jLINK] : LINK,
  [jMIM] : MIM,
  [jXJOE] : XJOE
};

const Erc20ToJoeDict = {
  [WAVAX] : jWAVAX,
  [WETH] : jWETH,
  [WBTC] : jWBTC,
  [USDC] : jUSDC,
  [USDT] : jUSDT,
  [DAI] : jDAI,
  [LINK] : jLINK,
  [MIM] : jMIM,
  [XJOE] : jXJOE
};

const tokenIdDict = {
  [WAVAX]   : "WAVAX",
  [WETH]    : "WETH",
  [WBTC]    : "WBTC",
  [USDC]    : "USDC",
  [USDT]    : "USDT",
  [DAI]     : "DAI",
  [LINK]    : "LINK",
  [MIM]     : "MIM",
  [XJOE]    : "XJOE",
  [jWAVAX]  : "jWAVAX",
  [jWETH]   : "jWETH",
  [jWBTC]   : "jWBTC",
  [jUSDC]   : "jUSDC",
  [jUSDT]   : "jUSDT",
  [jDAI]    : "jDAI",
  [jLINK]   : "jLINK",
  [jMIM]    : "jMIM",
  [jXJOE]   : "jXJOE"
};

const tokenExp = {
  [WAVAX]   : 1e18,
  [WETH]    : 1e18,
  [WBTC]    : 1e8,
  [USDC]    : 1e6,
  [USDT]    : 1e6,
  [DAI]     : 1e18,
  [LINK]    : 1e18,
  [MIM]     : 1e18,
  [XJOE]    : 1e18,
  [jWAVAX]  : 1e8,
  [jWETH]   : 1e8,
  [jWBTC]   : 1e8,
  [jUSDC]   : 1e8,
  [jUSDT]   : 1e8,
  [jDAI]    : 1e8,
  [jLINK]   : 1e8,
  [jMIM]    : 1e8,
  [jXJOE]   : 1e8
};


module.exports = { createContractsDict, tokenIdDict, tokenExp, joeToErc20Dict, Erc20ToJoeDict };