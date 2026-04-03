const hre = require("hardhat");

async function main() {
  const { ethers, network } = hre;

  console.log(`\n--- Starting Deployment on Network: ${network.name} ---`);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  let stakingTokenAddress = process.env.STAKING_TOKEN?.trim();
  const ownerAddress = process.env.STAKING_OWNER?.trim() || deployer.address;

  const isLocal = network.name === "hardhat" || network.name === "localhost";

  // Deploy Mock token only on local networks if address isn't provided
  if (!stakingTokenAddress) {
    if (!isLocal) {
      throw new Error("Set STAKING_TOKEN in .env for Sepolia deployment.");
    }
    console.log("Deploying MockERC20 for local use...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mock = await MockERC20.deploy(
      "Stake Token",
      "STK",
      ethers.parseEther("1000000"),
    );
    await mock.waitForDeployment();
    stakingTokenAddress = await mock.getAddress();
    console.log("MockERC20 deployed to:", stakingTokenAddress);
  }

  // Deploy Staking Contract
  console.log("Deploying Staking contract...");
  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(stakingTokenAddress, ownerAddress);

  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();

  console.log("Staking deployed to:", stakingAddress);
  console.log("Configured Token:", stakingTokenAddress);
  console.log("Configured Owner:", ownerAddress);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
