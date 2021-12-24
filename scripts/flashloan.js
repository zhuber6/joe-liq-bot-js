
wavaxjsonabi = require('./wavaxABI.json');
contracts = require('./contracts.json');

const main = async () => {
  
  // The address that has WAVAX on mainnet
  const whaleAddress = '0xB9F79Fc4B7A2F5fB33493aB5D018dB811c9c2f02'
  const testOverLevAccount = '0x0e0a92d82572753a64eed810e43974f235351dab'
  
  // Become whale
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whaleAddress]
  });

  const wallet  = await hre.ethers.provider.getSigner(whaleAddress);
  const FlashloanBorrowerFactory = await hre.ethers.getContractFactory('FlashloanBorrower');
  
  // deploy flashloan Borrower contract
  const flashloanBorrowerContract = await FlashloanBorrowerFactory.deploy(contracts.joetrollerAddr);
  await flashloanBorrowerContract.deployed();
  console.log("Contract deployed to:", flashloanBorrowerContract.address);
  
  // Get loan borrower wallet, not used
  // const flashloanWallet = await hre.ethers.provider.getSigner(flashloanBorrowerContract.address);

  // Set WAVAX contract info
  const WAVAX = new ethers.Contract(contracts.WAVAX, wavaxjsonabi, wallet);
  
  // Send 1 WAVAX to flash loan Borrower contract,
  // so that you have enough fund to pay the fee.
  let tx = await WAVAX.transfer(flashloanBorrowerContract.address, BigInt(1 * 1e18))
  // let txreceipt = await tx.wait()
  
  // call the doFlashloan
  tx = await flashloanBorrowerContract.doFlashloan(contracts.flashloanLenderAddr, BigInt(100 * 1e18), testOverLevAccount);
  // const receipt = await tx.wait()

  // see the result
  // console.log(receipt.events)

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