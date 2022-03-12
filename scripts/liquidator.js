const axios = require('axios');
const APIURL = 'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/lending'

const { tokenIdDict, joeToErc20Dict } = require('../common/contractsDict.js');

const joetroller  = "0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC";
const joeOracle   = "0xd7Ae651985a871C1BC254748c40Ecc733110BC2E";
const joeRouter   = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";

const WAVAX   = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7";
const WETH    = "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab";
const WBTC    = "0x50b7545627a5162f82a992c33b87adc75187b218";
const USDC    = "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664";
const USDT    = "0xc7198437980c041c805a1edcba50c1ce5db95118";
const DAI     = "0xd586e7f844cea2f87f50152665bcbc2c279d8d70";
const LINK    = "0x5947bb275c521040051d82396192181b413227a3";
const MIM     = "0x130966628846bfd36ff31a822705796e8cb8c18d";
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


const main = async () => {
  underwater = setUnderWaterString(0 , 1, 0);

  hre.ethers.provider.on("block", async (block) => {

    const results = await query_graph( underwater );
    const underWaterAccounts = results.data.data.accounts;

    for (let accounts of underWaterAccounts) {
      console.log(accounts.id)
      console.log("HEALTH: ", accounts.health)
      console.log("total borrow value in USD: ", accounts.totalBorrowValueInUSD)
      console.log("total collateral value in USD: ", accounts.totalCollateralValueInUSD)

      for (let tokens of accounts.tokens) {
        if (tokens.supplyBalanceUnderlying > 0  && 
          tokens.enteredMarket == true) {
          console.log(tokens.symbol, "supply balance underlying: ", tokens.supplyBalanceUnderlying)
        }
        if (tokens.borrowBalanceUnderlying > 0 ) {
          console.log(tokens.symbol, "borrow balance underlying: ", tokens.borrowBalanceUnderlying)
        }

        console.log("token contract: ", tokens.id.split('-')[0])
      }
    }
    
    process.exit(0);

  });
}

const runMain = async () => {
  await main();
};

async function query_graph ( query_str ) {
  const result = await axios.post(
    APIURL,
    {
      query: query_str
    }
  );
  return result;
}

function setUnderWaterString (health_gt, health_lt, totalBorrowValueInUSD_gt) { 
  const underWater = 
  `{
    # accounts(where: {health_gt: ${health_gt}, health_lt: ${health_lt}, totalBorrowValueInUSD_gt: ${totalBorrowValueInUSD_gt}}) {
    accounts(where: {health_gt: ${health_gt}, health_lt: ${health_lt}, totalBorrowValueInUSD_gt: 0.1}) {
      id
      health
      totalBorrowValueInUSD
      totalCollateralValueInUSD
      tokens {
        id
        symbol
        supplyBalanceUnderlying
        borrowBalanceUnderlying
        enteredMarket
      }
    }
  }`
  return underWater;
}

runMain();