import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useSignMessage } from "wagmi";
import { getApiBase } from "../config/api";
import { SUPPORTED_CHAIN_IDS } from "../config/networkConfig";
import {
  decodeJwtPayload,
  getStoredBackendToken,
  isJwtLikelyExpired,
  setStoredBackendToken,
} from "../lib/walletAuthStorage";

type MeResponse = { walletAddress: string; userId: string };

export type WalletBackendAuthContextValue = {
  token: string | null;
  authHeaders: Record<string, string>;
  backendUser: MeResponse | null;
  isBackendAuthed: boolean;
  needsBackendSign: boolean;
  jwtRole: "admin" | "user" | null;
  error: string | null;
  validating: boolean;
  signingIn: boolean;
  signInWithWallet: () => Promise<void>;
  logoutBackend: () => Promise<void>;
  refreshMe: (overrideToken?: string | null) => Promise<void>;
  onSupportedChain: boolean;
};

const WalletBackendAuthContext = createContext<WalletBackendAuthContextValue | null>(null);

function useWalletBackendAuthImpl(): WalletBackendAuthContextValue {
  const { address, isConnected, chain } = useAccount();
  const { signMessageAsync, isPending: signing } = useSignMessage();

  const [token, setTokenState] = useState<string | null>(() => getStoredBackendToken());
  const [backendUser, setBackendUser] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const onSupportedChain =
    isConnected && chain?.id !== undefined && SUPPORTED_CHAIN_IDS.includes(chain.id);

  const setToken = useCallback((t: string | null) => {
    setStoredBackendToken(t);
    setTokenState(t);
  }, []);

  const authHeaders: Record<string, string> = useMemo(() => {
    if (!token) return {} as Record<string, string>;
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const refreshMe = useCallback(
    async (overrideToken?: string | null) => {
      const t = overrideToken === undefined ? token : overrideToken;
      if (!t) {
        setBackendUser(null);
        return;
      }
      if (isJwtLikelyExpired(t)) {
        setToken(null);
        setBackendUser(null);
        return;
      }
      setValidating(true);
      setError(null);
      try {
        const res = await fetch(`${getApiBase()}/auth/me`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (!res.ok) {
          setToken(null);
          setBackendUser(null);
          return;
        }
        const data = (await res.json()) as MeResponse;
        setBackendUser(data);
      } catch {
        setToken(null);
        setBackendUser(null);
      } finally {
        setValidating(false);
      }
    },
    [token, setToken],
  );

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (!address || !token) return;
    const payload = decodeJwtPayload(token);
    const subWallet =
      typeof payload?.wallet === "string" ? (payload.wallet as string).toLowerCase() : null;
    if (subWallet && subWallet !== address.toLowerCase()) {
      setToken(null);
      setBackendUser(null);
    }
  }, [address, token, setToken]);

  const isBackendAuthed = Boolean(
    token && backendUser && address && backendUser.walletAddress.toLowerCase() === address.toLowerCase(),
  );

  const jwtRole = useMemo(() => {
    if (!token) return null;
    const p = decodeJwtPayload(token);
    const r = p?.role;
    return r === "admin" || r === "user" ? r : null;
  }, [token]);

  const signInWithWallet = useCallback(async () => {
    if (!address || !chain?.id) {
      setError("Connect a wallet on a supported network first.");
      return;
    }
    setSigningIn(true);
    setError(null);
    try {
      const ch = await fetch(`${getApiBase()}/auth/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, chainId: chain.id }),
      });
      if (!ch.ok) {
        const t = await ch.text();
        throw new Error(t || "Could not request sign-in message.");
      }
      const { message } = (await ch.json()) as { message: string };
      const signature = await signMessageAsync({ message, account: address });
      const vr = await fetch(`${getApiBase()}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      if (!vr.ok) {
        const t = await vr.text();
        throw new Error(t || "Verification failed.");
      }
      const body = (await vr.json()) as { accessToken: string };
      setToken(body.accessToken);
      await refreshMe(body.accessToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed.";
      setError(msg);
    } finally {
      setSigningIn(false);
    }
  }, [address, chain?.id, refreshMe, setToken, signMessageAsync]);

  const logoutBackend = useCallback(async () => {
    if (!token) {
      setToken(null);
      setBackendUser(null);
      return;
    }
    try {
      await fetch(`${getApiBase()}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* still clear local session */
    } finally {
      setToken(null);
      setBackendUser(null);
    }
  }, [setToken, token]);

  const needsBackendSign =
    isConnected &&
    onSupportedChain &&
    Boolean(address) &&
    !isBackendAuthed &&
    !validating &&
    !signingIn &&
    !signing;

  return {
    token,
    authHeaders,
    backendUser,
    isBackendAuthed,
    needsBackendSign,
    jwtRole,
    error,
    validating,
    signingIn: signingIn || signing,
    signInWithWallet,
    logoutBackend,
    refreshMe,
    onSupportedChain,
  };
}

export function WalletBackendAuthProvider({ children }: { children: ReactNode }) {
  const value = useWalletBackendAuthImpl();
  return (
    <WalletBackendAuthContext.Provider value={value}>{children}</WalletBackendAuthContext.Provider>
  );
}

export function useWalletBackendAuth(): WalletBackendAuthContextValue {
  const ctx = useContext(WalletBackendAuthContext);
  if (!ctx) {
    throw new Error("useWalletBackendAuth must be used within WalletBackendAuthProvider");
  }
  return ctx;
}
