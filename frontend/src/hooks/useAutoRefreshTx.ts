import { useCallback, useState } from "react";
import { usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

type TxHash = `0x${string}`;

/**
 * Sends a tx (returns hash), waits for it to be mined,
 * then invalidates read queries so the UI refreshes automatically.
 */
export function useAutoRefreshTx() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [mining, setMining] = useState(false);

  const run = useCallback(
    async (send: () => Promise<TxHash>) => {
      if (!publicClient) throw new Error("Public client not available");
      setMining(true);
      try {
        const hash = await send();
        await publicClient.waitForTransactionReceipt({ hash });

        // wagmi readContract hooks use TanStack Query under the hood
        // invalidate them so balances/planCount/positions/etc refresh everywhere.
        await queryClient.invalidateQueries({
          predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "readContract",
        });

        return hash;
      } finally {
        setMining(false);
      }
    },
    [publicClient, queryClient],
  );

  return { run, mining };
}

