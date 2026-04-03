require("dotenv").config({ quiet: true });
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      chainId: 11155111,
      accounts: (() => {
        const pk = process.env.PRIVATE_KEY?.trim();
        if (!pk) return [];
        return [pk.startsWith("0x") ? pk : `0x${pk}`];
      })(),
    },
  },
};
