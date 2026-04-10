const { ethers, upgrades, network, run } = require("hardhat");

async function main() {
  const proxyAddress = (process.env.STAKING_PROXY || "").trim();
  if (!proxyAddress) {
    throw new Error("Missing STAKING_PROXY in .env (the proxy address to upgrade).");
  }

  const isLocal = network.name === "hardhat" || network.name === "localhost";

  console.log(`\n--- Starting Upgrade on: ${network.name} ---`);
  console.log("Proxy:", proxyAddress);

  const Staking = await ethers.getContractFactory("Staking");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, Staking, {
    kind: "uups",
  });

  await upgraded.waitForDeployment();

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n--- Upgrade SUCCESS ---");
  console.log("Proxy Address:          ", proxyAddress);
  console.log("New Implementation:     ", implementationAddress);

  if (!isLocal) {
    console.log("\nWaiting for 6 block confirmations for Etherscan...");
    await upgraded.deploymentTransaction().wait(6);

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

