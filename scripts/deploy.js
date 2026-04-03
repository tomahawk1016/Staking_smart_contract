const { ethers, upgrades, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(`\n--- Starting Deployment on: ${network.name} ---`);
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Determine the Staking Token Address
  let stakingTokenAddress = process.env.STAKING_TOKEN?.trim();
  const ownerAddress = process.env.STAKING_OWNER?.trim() || deployer.address;

  const isLocal = network.name === "hardhat" || network.name === "localhost";

  // If on local network and no token provided, deploy a Mock ERC20
  if (!stakingTokenAddress) {
    if (!isLocal) {
      throw new Error("Missing STAKING_TOKEN in .env for public network deployment.");
    }
    console.log("Deploying MockERC20 for local testing...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mock = await MockERC20.deploy("Stake Token", "STK", ethers.parseEther("1000000"));
    await mock.waitForDeployment();
    stakingTokenAddress = await mock.getAddress();
    console.log("MockERC20 deployed to:", stakingTokenAddress);
  }

  // 2. Deploy the Staking Contract as a UUPS Proxy
  console.log("Deploying Staking Proxy...");
  const Staking = await ethers.getContractFactory("Staking");

  // upgrades.deployProxy(ContractFactory, [args for initialize], { options })
  const stakingProxy = await upgrades.deployProxy(
    Staking, 
    [stakingTokenAddress, ownerAddress], 
    { 
      initializer: "initialize", // Function name to call on deployment
      kind: "uups"               // Specific upgrade pattern
    }
  );

  await stakingProxy.waitForDeployment();

  const proxyAddress = await stakingProxy.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n--- Deployment SUCCESS ---");
  console.log("Staking Proxy Address (Use this!):", proxyAddress);
  console.log("Implementation Address (Logic):    ", implementationAddress);
  console.log("Staking Token Address:             ", stakingTokenAddress);
  console.log("Initial Owner:                     ", ownerAddress);

  // 3. Verify on Etherscan (if not local)
  if (!isLocal) {
    console.log("\nWaiting for 6 block confirmations for Etherscan...");
    // The implementation address is what needs to be verified
    await stakingProxy.deploymentTransaction().wait(6);

    try {
      await run("verify:verify", {
        address: implementationAddress,
      });
      console.log("Verification Successful!");
    } catch (error) {
      console.log("Verification Error (might already be verified):", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });