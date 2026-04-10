import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { heartbeatUser, isBackendConfigured, logoutUser, registerUser } from "../lib/apiBackend";

const HEARTBEAT_MS = 45_000;

/**
 * Registers the connected wallet with the API, sends heartbeats while connected,
 * and marks the user offline on disconnect or wallet switch.
 */
export function useBackendSession() {
  const { address, isConnected } = useAccount();
  const tracked = useRef<string | null>(null);

  useEffect(() => {
    if (!isBackendConfigured()) return;

    if (!isConnected) {
      const prev = tracked.current;
      if (prev) {
        void logoutUser(prev);
        tracked.current = null;
      }
      return;
    }

    if (!address) return;

    const prev = tracked.current;
    if (prev && prev.toLowerCase() !== address.toLowerCase()) {
      void logoutUser(prev);
    }
    tracked.current = address;

    void registerUser(address);

    const t = window.setInterval(() => {
      void heartbeatUser(address);
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(t);
    };
  }, [isConnected, address]);
}
