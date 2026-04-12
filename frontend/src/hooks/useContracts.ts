import { useMemo } from "react";
import { useAccount } from "wagmi";
import { CONTRACTS, ERC20_ABI, STAKING_ABI } from "../config/contracts";

export function useContracts() {
  const { chain } = useAccount();
  const onSupportedChain = chain?.id === CONTRACTS.chainId;

  return useMemo(
    () => ({
      onSupportedChain,
      staking: {
        address: CONTRACTS.stakingProxy,
        abi: STAKING_ABI,
      },
      token: {
        address: CONTRACTS.stakingToken,
        abi: ERC20_ABI,
      },
    }),
    [onSupportedChain],
  );
}

