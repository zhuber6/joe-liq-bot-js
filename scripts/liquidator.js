const axios = require('axios');
const APIURL = 'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/lending'

const { createContractsDict, tokenIdDict, joeToErc20Dict } = require('../common/contractsDict.js');

const WAVAX   = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const WETH    = "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB";
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

const main = async () => {

  const [myAccount] = await hre.ethers.getSigners();

  const FlashLiquidatorFactory = await hre.ethers.getContractFactory('FlashLiquidator');
  const liquidatorContract = await FlashLiquidatorFactory.attach("0x848b3aBd5f73F96baa462a3a794f03D74ED4cf81");

  // Get inital WAVAX amount in wallet
  let myAvaxAmount = await hre.ethers.provider.getBalance(myAccount.address);

  // Set my contracts up
  contractsDict = createContractsDict(myAccount);

  // Set underwater string with parameters
  health_gt = 0.75;
  health_lt = 1;
  totalBorrowValueInUSD_gt = 10;
  underwater = setUnderWaterString(health_gt , health_lt, totalBorrowValueInUSD_gt);

  // Start watching blocks to trigger liquidation
  hre.ethers.provider.on("block", async (block) => {

    // Store current prices in dictionary
    let results = await query_graph( underlyingUSD );
    var prices = {};
    for (let market of results.data.data.markets) {
      prices[[market.id]] = market.underlyingPriceUSD
    }

    // Get underwater accounts according to parameters defined in graph query string
    results = await query_graph( underwater );
    const underWaterAccounts = results.data.data.accounts;

    // Iterate through accounts to find account to liquidate
    for (let accounts of underWaterAccounts) {
      
      var arrayMaxSupply = new Array(accounts.tokens.length).fill(0);
      var arrayMaxBorrow = new Array(accounts.tokens.length).fill(0);
      let index = 0;

      // Iterate through tokens
      for (let tokens of accounts.tokens) {
        if (tokens.supplyBalanceUnderlying > 0  && 
            tokens.enteredMarket == true) 
        {
          const tokenSuppliedUSD = tokens.supplyBalanceUnderlying * prices[tokens.id.split('-')[0].toLowerCase()];
          arrayMaxSupply[index] = tokenSuppliedUSD;
        }
        if (tokens.borrowBalanceUnderlying > 0 )
        {
          const tokenBorrowedUSD = tokens.borrowBalanceUnderlying * prices[tokens.id.split('-')[0].toLowerCase()];
          arrayMaxBorrow[index] = tokenBorrowedUSD;
        }
        index++;
      }
      
      // Move forward only if account is short
      [err, liq, short] = await contractsDict.joetroller.getAccountLiquidity(accounts.id);
      if ( short > 0 ) {
        
        // Find max supply and borrow positions
        const maxSupplyIndex = arrayMaxSupply.indexOf(Math.max(...arrayMaxSupply));
        const maxBorrowIndex = arrayMaxBorrow.indexOf(Math.max(...arrayMaxBorrow));
        
        const supplyjToken = accounts.tokens[maxSupplyIndex].id.split('-')[0];
        const borrowjToken = accounts.tokens[maxBorrowIndex].id.split('-')[0];
        let flashjToken;

        const maxSupplyUSD = accounts.tokens[maxSupplyIndex].supplyBalanceUnderlying * prices[supplyjToken.toLowerCase()]
        const maxBorrowUSD = accounts.tokens[maxBorrowIndex].borrowBalanceUnderlying * prices[borrowjToken.toLowerCase()]

        // Use WAVAX flash loan unless it is the token being liquidated
        if ( borrowjToken != jWAVAX ) {
          flashjToken = jWAVAX;
        }
        else {
          flashjToken = jDAI;
        }

        // For now only liquidate if this threshold is met
        // TODO: Fix this to handle liquidation of multiple borrow positions and supply positions
        // TODO: Doesn't handle XJOE as supplied token
        if ( (maxBorrowUSD / 2 > maxSupplyUSD) && ( jXJOE != supplyjToken ) )
        {
          console.log("Max supply underlying USD %s: %d", accounts.tokens[maxSupplyIndex].symbol, maxSupplyUSD);
          console.log("Max borrow underlying USD %s: %d", accounts.tokens[maxBorrowIndex].symbol, maxBorrowUSD);
          console.log("Borrower Shortfall: %d", short / 1e18);
          console.log("Attempting liquidation");

          // Attempt to liquidate
          const txFlash = await liquidatorContract.doFlashloan(
            flashjToken,                    // address: flashloanLender
            joeToErc20Dict[flashjToken],    // address: flashLoanToken
            accounts.id,                    // address: borrowerToLiquidate
            borrowjToken,                   // address: jTokenBorrowed
            joeToErc20Dict[borrowjToken],   // address: jTokenBorrowedUnderlying
            supplyjToken,                   // address: jTokenSupplied
            joeToErc20Dict[supplyjToken]    // address: jTokenSuppliedUnderlying
          )

          // Calculate profit
          const beforeAvaxAmount = await hre.ethers.provider.getBalance(myAccount.address);
          avaxProfit = myAvaxAmount - beforeAvaxAmount;
          myAvaxAmount = beforeAvaxAmount;
        }
      }
    }
  }); // End of provider.on block
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
    accounts(where: {health_gt: ${health_gt}, health_lt: ${health_lt}, totalBorrowValueInUSD_gt: ${totalBorrowValueInUSD_gt}}) {
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

const underlyingUSD = 
`{
  markets  {
    id
    symbol
    underlyingPriceUSD
  }
}`

runMain();