import { useMemo } from "react";
import { useAccount } from "wagmi";
import { zeroAddress } from "viem";
import { ERC20_ABI, STAKING_ABI } from "../config/contracts";
import { getContractsForChain } from "../config/networkConfig";

export function useContracts() {
  const { chain } = useAccount();
  const cfg = getContractsForChain(chain?.id);
  const onSupportedChain = Boolean(cfg);

  return useMemo(
    () => ({
      onSupportedChain,
      staking: {
        address: cfg?.stakingProxy ?? zeroAddress,
        abi: STAKING_ABI,
      },
      token: {
        address: cfg?.stakingToken ?? zeroAddress,
        abi: ERC20_ABI,
      },
    }),
    [onSupportedChain, cfg?.stakingProxy, cfg?.stakingToken],
  );
}
