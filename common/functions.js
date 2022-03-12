

async function getCurrentTimestamp()  {
  let block     = await web3.eth.getBlockNumber();
  let blockObj  = await web3.eth.getBlock(block);
  return blockObj.timestamp;
}

async function swapAvaxForTokens( contractsDict, tokenIn, to, amount) {
  
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

async function swapTokensForTokens( tokenInContract, tokenOutContract, to, amount ) {
  
  // Get timestamp for swap
  let timestamp = await getCurrentTimestamp();

  // Swap ERC token for AVAX
  tx = await tokenInContract.approve(contractsDict.joerouter.address, amount);
  receipt = await tx.wait();
  tx = await contractsDict.joerouter.swapExactTokensForAVAX(
    amount,
    0,
    [ tokenInContract.address, tokenOutContract.address ],
    to,
    BigInt(timestamp + 60)
  )
  receipt = await tx.wait();
}


module.exports = { 
  getCurrentTimestamp,
  swapAvaxForTokens,
  swapTokensForAvax,
  swapTokensForTokens
};