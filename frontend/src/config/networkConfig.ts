import { http, type HttpTransport } from "viem";
import { mainnet, sepolia, type Chain } from "viem/chains";
import { hardhatLocal } from "../web3/chains";

export type AppChainContracts = {
  stakingProxy: `0x${string}`;
  stakingToken: `0x${string}`;
};

type NetworkEntry = { chain: Chain; contracts: AppChainContracts };

function parseAddr(v: string | undefined, fallback: `0x${string}`): `0x${string}` {
  const t = v?.trim();
  if (t && /^0x[a-fA-F0-9]{40}$/.test(t)) return t as `0x${string}`;
  return fallback;
}

/** Matches README / `.openzeppelin/sepolia.json` — override with VITE_SEPOLIA_* if you redeploy. */
const SEPOLIA_DEFAULT: AppChainContracts = {
  stakingProxy: "0x0A651822fe1e678fBAA3a5c8b50AAcA285C6A6df",
  stakingToken: "0x71A8e20013E341B30AA60F60146Da4692319B23a",
};

/** Local Hardhat defaults from this repo’s sample deploy; override with VITE_LOCALHOST_*. */
const LOCAL_DEFAULT: AppChainContracts = {
  stakingProxy: "0x0A651822fe1e678fBAA3a5c8b50AAcA285C6A6df",
  stakingToken: "0x71A8e20013E341B30AA60F60146Da4692319B23a",
};

function buildNetworkEntries(): NetworkEntry[] {
  const list: NetworkEntry[] = [];

  if (import.meta.env.VITE_ENABLE_SEPOLIA !== "false") {
    list.push({
      chain: sepolia,
      contracts: {
        stakingProxy: parseAddr(import.meta.env.VITE_SEPOLIA_STAKING_PROXY, SEPOLIA_DEFAULT.stakingProxy),
        stakingToken: parseAddr(import.meta.env.VITE_SEPOLIA_STAKING_TOKEN, SEPOLIA_DEFAULT.stakingToken),
      },
    });
  }

  const mainProxy = import.meta.env.VITE_MAINNET_STAKING_PROXY?.trim();
  const mainToken = import.meta.env.VITE_MAINNET_STAKING_TOKEN?.trim();
  if (
    mainProxy &&
    mainToken &&
    /^0x[a-fA-F0-9]{40}$/.test(mainProxy) &&
    /^0x[a-fA-F0-9]{40}$/.test(mainToken)
  ) {
    list.push({
      chain: mainnet,
      contracts: {
        stakingProxy: mainProxy as `0x${string}`,
        stakingToken: mainToken as `0x${string}`,
      },
    });
  }

  if (import.meta.env.VITE_ENABLE_LOCALHOST === "true") {
    list.push({
      chain: hardhatLocal,
      contracts: {
        stakingProxy: parseAddr(import.meta.env.VITE_LOCALHOST_STAKING_PROXY, LOCAL_DEFAULT.stakingProxy),
        stakingToken: parseAddr(import.meta.env.VITE_LOCALHOST_STAKING_TOKEN, LOCAL_DEFAULT.stakingToken),
      },
    });
  }

  if (!list.length) {
    list.push({
      chain: sepolia,
      contracts: SEPOLIA_DEFAULT,
    });
  }

  return list;
}

const ENTRIES = buildNetworkEntries();
const CONTRACTS_BY_ID = new Map<number, AppChainContracts>(
  ENTRIES.map((e) => [e.chain.id, e.contracts]),
);

export const APP_WAGMI_CHAINS = ENTRIES.map((e) => e.chain) as [Chain, ...Chain[]];

export function getContractsForChain(chainId: number | undefined): AppChainContracts | null {
  if (chainId === undefined) return null;
  return CONTRACTS_BY_ID.get(chainId) ?? null;
}

export const SUPPORTED_CHAIN_IDS = ENTRIES.map((e) => e.chain.id);

export function getPreferredChainId(): number {
  const raw = import.meta.env.VITE_DEFAULT_CHAIN_ID?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const id = Number(raw);
    if (SUPPORTED_CHAIN_IDS.includes(id)) return id;
  }
  return ENTRIES[0]!.chain.id;
}

export function chainLabel(chainId: number): string {
  const ch = ENTRIES.find((e) => e.chain.id === chainId)?.chain;
  return ch?.name ?? `Chain ${chainId}`;
}

export function supportedNetworksSentence(): string {
  return ENTRIES.map((e) => `${e.chain.name} (${e.chain.id})`).join(", ");
}

export function wrongNetworkUserHint(): string {
  return `This app is configured for: ${supportedNetworksSentence()}. Use “Switch network” in the header.`;
}

const SEPOLIA_HTTP_URL =
  import.meta.env.VITE_SEPOLIA_RPC_URL?.trim() ||
  "https://ethereum-sepolia-rpc.publicnode.com";

export function buildTransports(): Record<number, HttpTransport> {
  const out: Record<number, HttpTransport> = {};
  for (const e of ENTRIES) {
    if (e.chain.id === sepolia.id) {
      out[e.chain.id] = http(SEPOLIA_HTTP_URL);
    } else if (e.chain.id === mainnet.id) {
      out[e.chain.id] = http(import.meta.env.VITE_MAINNET_RPC_URL?.trim() || undefined);
    } else {
      out[e.chain.id] = http(hardhatLocal.rpcUrls.default.http[0]);
    }
  }
  return out;
}
