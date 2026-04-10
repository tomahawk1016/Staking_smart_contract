/**
 * Public block explorer URLs for deployed contracts (share these with others).
 */
const BASE = {
  sepolia: "https://sepolia.etherscan.io",
};

function addressPage(networkName, address) {
  const base = BASE[networkName];
  if (!base || !address) return null;
  return `${base}/address/${address}`;
}

function printAddressOnExplorer(networkName, address, label) {
  const url = addressPage(networkName, address);
  if (!url) return;
  console.log(`\n--- ${label} (share this link) ---`);
  console.log(url);
}

module.exports = { addressPage, printAddressOnExplorer };
