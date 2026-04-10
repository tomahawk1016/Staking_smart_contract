const { ethers, network, run } = require("hardhat");
const { printAddressOnExplorer } = require("./scanUrls");

/**
 * Deploy MockERC20 (mint full supply to deployer).
 *
 * Root .env for Sepolia:
 *   SEPOLIA_RPC_URL, PRIVATE_KEY
 * Optional:
 *   MOCK_TOKEN_NAME      (default: Stake Token)
 *   MOCK_TOKEN_SYMBOL    (default: STK)
 *   MOCK_TOKEN_SUPPLY    (default: 1000000 — human amount, 18 decimals)
 *   ETHERSCAN_API_KEY    (for verification on public networks)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const isLocal = network.name === "hardhat" || network.name === "localhost";

  const name = process.env.MOCK_TOKEN_NAME?.trim() || "Koma Token";
  const symbol = process.env.MOCK_TOKEN_SYMBOL?.trim() || "Kom";
  const supplyHuman = process.env.MOCK_TOKEN_SUPPLY?.trim() || "100000000";
  const initialSupply = ethers.parseEther(supplyHuman);

  console.log(`\n--- MockERC20 on ${network.name} ---`);
  console.log("Deployer:", deployer.address);
  console.log("Name / symbol / supply:", name, "/", symbol, "/", supplyHuman, "(18 decimals)");

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy(name, symbol, initialSupply);
  await token.waitForDeployment();

  const mock = await ethers.getContractAt("MockERC20", "0x12007b18e3E9912bB6869B2e0747Bed598E3aAbd");
  await mock.transfer("0x4E34939B06Fc695b4a1C39b8A1f947f3A9e8930c", ethers.parseEther("2000000"));
  await mock.transfer("0x24f76c9c3676d63E5fC11054c40de4e3eB6CF10d", ethers.parseEther("5000000"));
  await mock.transfer("0xAbd8E84Fce6Bec08a32F7d2526e8f9A4a95CA506", ethers.parseEther("60000000"));

 
  const address = await token.getAddress();
  console.log("\nMockERC20 deployed to:", address);
  printAddressOnExplorer(network.name, address, "MockERC20 on Sepolia Etherscan");
  console.log("\nAdd to your .env for staking deploy:");
  console.log(`STAKING_TOKEN=${address}`);

  if (!isLocal && process.env.ETHERSCAN_API_KEY) {
    console.log("\nWaiting 6 confirmations before automated verification...");
    await token.deploymentTransaction().wait(6);
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [name, symbol, initialSupply],
      });
      console.log("Source code verification on Etherscan succeeded.");
    } catch (e) {
      console.log("Automated verify failed:", e.message);
      console.log(
        "The token is still deployed on-chain. Others can use the link above; source may show as unverified until you retry.",
      );
      if (network.name === "sepolia") {
        console.log("\nRetry manually (after a minute, if Etherscan was slow):");
        console.log(
          `  npx hardhat verify --network sepolia ${address} "${name}" "${symbol}" "${initialSupply.toString()}"`,
        );
      }
    }
  } else if (!isLocal) {
    console.log("\n(No ETHERSCAN_API_KEY — add one to .env to auto-verify source code.)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
