import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useWatchBlockNumber } from "wagmi";

/**
 * Refetches all wagmi contract reads when the chain produces a new block.
 * Pending rewards depend on block.timestamp, which only advances per block on local nodes.
 */
export function useInvalidateReadsOnNewBlock(enabled: boolean) {
  const queryClient = useQueryClient();

  const onBlockNumber = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "readContract",
    });
  }, [queryClient]);

  useWatchBlockNumber({
    enabled,
    onBlockNumber,
  });
}
