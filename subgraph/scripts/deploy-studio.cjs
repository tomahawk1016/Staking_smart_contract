/**
 * Deploy the subgraph to Graph Studio.
 *
 * Prerequisites:
 * 1. Copy subgraph/.env.example → subgraph/.env
 * 2. In Studio (thegraph.com/studio): create the subgraph and copy the Deploy Key + slug.
 * 3. Edit subgraph/subgraph.yaml (network, proxy address, startBlock) then run this script.
 *
 * Usage: npm run deploy:studio   (from subgraph/)   or   npm run subgraph:deploy   (from repo root)
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const subgraphRoot = path.join(__dirname, "..");
const envPath = path.join(subgraphRoot, ".env");

if (!fs.existsSync(envPath)) {
  console.error("Missing subgraph/.env — copy subgraph/.env.example to subgraph/.env and set variables.");
  process.exit(1);
}

require("dotenv").config({ path: envPath });

const deployKey = process.env.GRAPH_DEPLOY_KEY?.trim();
const slug = process.env.SUBGRAPH_STUDIO_SLUG?.trim();
const versionLabel = (process.env.SUBGRAPH_VERSION_LABEL || "manual").trim();

if (!deployKey || !slug) {
  console.error("Set GRAPH_DEPLOY_KEY and SUBGRAPH_STUDIO_SLUG in subgraph/.env");
  process.exit(1);
}

if (!/^[\w./-]+$/.test(slug)) {
  console.error("SUBGRAPH_STUDIO_SLUG contains unsupported characters.");
  process.exit(1);
}

const STUDIO_DEPLOY_NODE = "https://api.studio.thegraph.com/deploy/";
const IPFS_API = "https://api.thegraph.com/ipfs/api/v0";

function runNpxGraph(args) {
  execSync(`npx graph ${args.join(" ")}`, {
    stdio: "inherit",
    cwd: subgraphRoot,
    shell: true,
    env: { ...process.env },
  });
}

console.log("→ graph codegen");
runNpxGraph(["codegen"]);
console.log("→ graph build");
runNpxGraph(["build"]);
console.log("→ graph deploy (Graph Studio)");

const quote = JSON.stringify;
const deployArgs = [
  "deploy",
  slug,
  "--version-label",
  versionLabel,
  "--node",
  STUDIO_DEPLOY_NODE,
  "--ipfs",
  IPFS_API,
  "--deploy-key",
  deployKey,
];
execSync(`npx graph ${deployArgs.map((a) => quote(a)).join(" ")}`, {
  stdio: "inherit",
  cwd: subgraphRoot,
  shell: true,
  env: { ...process.env },
});

console.log("\nDone. Copy the Query URL from Studio into backend SUBGRAPH_QUERY_URL.");
