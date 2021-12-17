
wavaxjsonabi = require('./wavaxABI.json');

const main = async () => {
  
  // The address that has WAVAX on mainnet
  const walletAddr = '0xB9F79Fc4B7A2F5fB33493aB5D018dB811c9c2f02'
  const WAVAXAddr = '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7'

  // below flashLender and joetroller
  const flashloanLenderAddr = '0xC22F01ddc8010Ee05574028528614634684EC29e' // JWrappedNativeDelegator
  const comptrollerAddr = '0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC'
  
  // Become whale
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [walletAddr]
  });

  const wallet  = await hre.ethers.provider.getSigner(walletAddr);
  const factory = await hre.ethers.getContractFactory('FlashloanBorrower');
  
  // deploy flashloan Borrower contract
  const flashloanBorrowerContract = await factory.deploy(comptrollerAddr);
  await flashloanBorrowerContract.deployed();
  console.log("Contract deployed to:", flashloanBorrowerContract.address);
  
  // Get loan borrower wallet, not used
  // const flashloanWallet = await hre.ethers.provider.getSigner(flashloanBorrowerContract.address);

  // Set WAVAX contract info
  const WAVAX = new ethers.Contract(WAVAXAddr, wavaxjsonabi, wallet);
  
  // Send 1 WAVAX to flash loan Borrower contract,
  // so that you have enough fund to pay the fee.
  let tx = await WAVAX.transfer(flashloanBorrowerContract.address, 1 * 1e6)
  // let txreceipt = await tx.wait()
  
  // call the doFlashloan
  tx = await flashloanBorrowerContract.doFlashloan(flashloanLenderAddr, WAVAXAddr, 100 * 1e6);
  // const receipt = await tx.wait()

  // see the result
  // console.log(receipt.events)

  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [walletAddr]
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