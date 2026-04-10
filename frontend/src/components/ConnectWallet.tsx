import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { hardhatLocal } from "../web3/chains";
import { Button } from "./ui/Button";
import { shortAddr } from "../lib/format";

export function ConnectWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const wrongNetwork = isConnected && chain?.id !== hardhatLocal.id;

  return (
    <div className="flex items-center gap-3">
      {isConnected ? (
        <>
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.45)]" />
            <span className="text-sm text-white/90">{shortAddr(address)}</span>
          </div>

          {wrongNetwork ? (
            <Button
              variant="danger"
              size="sm"
              loading={switching}
              onClick={() => switchChain({ chainId: hardhatLocal.id })}
            >
              Switch to Hardhat
            </Button>
          ) : null}

          <Button variant="ghost" size="sm" onClick={() => disconnect()}>
            Disconnect
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          loading={isPending}
          onClick={() => {
            const mm = connectors.find((c) => c.id.toLowerCase().includes("metamask")) ?? connectors[0];
            connect({ connector: mm });
          }}
        >
          Connect wallet
        </Button>
      )}
    </div>
  );
}

