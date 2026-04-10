const { ethers, upgrades, network, run } = require("hardhat");
const { printAddressOnExplorer } = require("./scanUrls");

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
    const token = await ethers.getContractAt("MockERC20", "0x5FbDB2315678afecb367f032d93F642f64180aa3");
    await token.transfer("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", ethers.parseEther("10000"));
    await token.transfer("0xdD2FD4581271e230360230F9337D5c0430Bf44C0", ethers.parseEther("200000"));
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

  printAddressOnExplorer(network.name, proxyAddress, "Staking proxy (dApp / integrations use this)");
  printAddressOnExplorer(network.name, implementationAddress, "Staking implementation (logic contract)");

  // 3. Verify on Etherscan (if not local)
  if (!isLocal) {
    console.log("\nWaiting for 6 block confirmations before automated verification...");
    await stakingProxy.deploymentTransaction().wait(6);

    try {
      await run("verify:verify", {
        address: implementationAddress,
      });
      console.log("Implementation source verification on Etherscan succeeded.");
    } catch (error) {
      console.log("Automated verify failed:", error.message);
      console.log(
        "Contracts are still deployed. Share the proxy link above; retry verify when the explorer responds.",
      );
      if (network.name === "sepolia") {
        console.log("\nRetry implementation verify manually:");
        console.log(`  npx hardhat verify --network sepolia ${implementationAddress}`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });