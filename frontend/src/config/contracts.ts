import { erc20Abi } from "viem";
import { stakingAbi } from "../web3/stakingAbi";

export const CONTRACTS = {
  chainId: 31337,
  stakingProxy: "0x9B716aBa4E4dc07210DA9dD1e97e0fB8c8372599" as const,
  stakingToken: "0x3796825C5bA7A0150AA39b813f97f8DDDc643D6d" as const,
};

export const STAKING_ABI = stakingAbi;
export const ERC20_ABI = erc20Abi;

