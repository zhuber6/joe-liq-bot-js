const axios = require('axios');
// const cheerio = require('cheerio');

// const fetch =  require('cross-fetch');
// const apollo = require('@apollo/client');


// import {ApolloClient, InMemoryCache, gql} from '@apollo/client';

// const APIURL = 'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/exchange'
const APIURL = 'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/lending'

const main = async ( ) => {

  health_gt = 0
  health_lt = 1.1
  totalBorrowValueInUSD_gt = 0
  blockNumber_gt = 8400000;
  blockNumber = 8450099;
  underWaterBorrower = "0xd65a65d17ba88726b61383147e9c013a8ef6ee0b";

  pastLiqEvents = setPastLiqEventsString();
  underWater = setUnderWaterString();

  // query graph for liq events
  pastLiqEventsResult = await query_graph( pastLiqEvents );
  liqEvents = pastLiqEventsResult.data.data.liquidationEvents;
  
  for (let events of liqEvents) {
    blockNumber = events.blockNumber - 1;
    underWaterBorrower = events.borrower

    underWater = setUnderWaterString();

    // query graph for underwater
    underWaterResult = await query_graph( underWater );
    
    console.log("BLOCKNUMBER: ", blockNumber);
    let underWaterAccounts = underWaterResult.data.data.accounts;
    parseUnderwaterAccounts( underWaterAccounts );
  }
}

async function query_graph ( query_str ) {
  const result = await axios.post(
    APIURL,
    {
      query: query_str
    }
  );
  return result;
}

function parseUnderwaterAccounts ( underWaterAccounts ) {
  
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
      }
    console.log()
  }

}

function setUnderWaterString () { 
  let underWater = 
  `{
    # accounts(block: { number: 8450099 }, where: {health_gt: ${health_gt}, health_lt: ${health_lt}, totalBorrowValueInUSD_gt: ${totalBorrowValueInUSD_gt}}) {
    accounts(where: {id: "${underWaterBorrower}"}, block: { number: ${blockNumber} }) {
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

function setPastLiqEventsString () {
  let pastLiqEvents = 
  `{
    liquidationEvents(where: {blockNumber_gt: ${blockNumber_gt}} ) {
      id
      borrower
      liquidator
      blockNumber
      blockTime
      underlyingCollateralSeizedSymbol
      underlyingCollateralSeizedAmount
      underlyingRepaySymbol
      underlyingRepayAmount
    }
  }`
  return pastLiqEvents;
}

const runMain = async () => {
  try {
    await main( );
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

runMain();