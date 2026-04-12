import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useWalletBackendAuth } from "../context/WalletBackendAuthProvider";
import { Button } from "./ui/Button";
import { shortAddr } from "../lib/format";
import { chainLabel, getPreferredChainId, SUPPORTED_CHAIN_IDS } from "../config/networkConfig";

export function ConnectWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const {
    isBackendAuthed,
    needsBackendSign,
    signingIn,
    signInWithWallet,
    logoutBackend,
    error: backendAuthError,
    validating,
  } = useWalletBackendAuth();

  const wrongNetwork = isConnected && chain?.id !== undefined && !SUPPORTED_CHAIN_IDS.includes(chain.id);
  const preferredId = getPreferredChainId();

  async function handleDisconnect() {
    await logoutBackend();
    disconnect();
  }

  return (
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
      {backendAuthError ? (
        <div className="max-w-[min(420px,92vw)] rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-100/90">
          {backendAuthError}
        </div>
      ) : null}
      {isConnected ? (
        <>
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.45)]" />
            <span className="text-sm text-white/90">{shortAddr(address)}</span>
          </div>

          {!wrongNetwork && isBackendAuthed ? (
            <div className="hidden sm:block text-xs text-emerald-200/80">Signed in</div>
          ) : null}

          {wrongNetwork ? (
            <Button
              variant="danger"
              size="sm"
              loading={switching}
              onClick={() => switchChain({ chainId: preferredId })}
            >
              Switch to {chainLabel(preferredId)}
            </Button>
          ) : needsBackendSign ? (
            <Button variant="primary" size="sm" loading={signingIn || validating} onClick={() => void signInWithWallet()}>
              Sign in (verify wallet)
            </Button>
          ) : null}

          <Button variant="ghost" size="sm" onClick={() => void handleDisconnect()}>
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
