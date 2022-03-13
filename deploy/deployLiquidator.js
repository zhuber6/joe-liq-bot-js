
const main = async () => {

  // get wallets as signer
  const [myAccount] = await hre.ethers.getSigners();
  const FlashLiquidatorFactory = await hre.ethers.getContractFactory('FlashLiquidator');

  const joeTroller = "0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC";
  const joeRouter =  "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";

  // deploy flashloan Borrower contract
  const myContract = await FlashLiquidatorFactory.deploy(
    joeTroller,
    joeRouter
  );
  await myContract.deployed();
  console.log("Flash Loan liquidator contract deployed to:", myContract.address, "from:", myAccount.address);

  // // Send AVAX to contract for gas
  // const transactionHash = await myAccount.sendTransaction({
  //   to: myContract.address,
  //   value: ethers.utils.parseEther("0.2"),
  // });
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