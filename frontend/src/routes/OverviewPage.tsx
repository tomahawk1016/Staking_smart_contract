import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useContracts } from "../hooks/useContracts";
import { useInvalidateReadsOnNewBlock } from "../hooks/useInvalidateReadsOnNewBlock";
import { formatToken } from "../lib/format";
import { useMemo } from "react";
import { Coins, Hourglass, Layers, Wallet } from "lucide-react";
import { wrongNetworkUserHint } from "../config/networkConfig";

const REALTIME_MS = 2000;
const PENDING_DIGITS = 6;

export function OverviewPage() {
  const { address, isConnected } = useAccount();
  const { staking, token, onSupportedChain } = useContracts();
  useInvalidateReadsOnNewBlock(onSupportedChain);

  const { data: decimals } = useReadContract({
    ...token,
    functionName: "decimals",
    query: { enabled: onSupportedChain, refetchInterval: REALTIME_MS },
  });

  const tokenDecimals = Number(decimals ?? 18);

  const { data: tokenSymbol } = useReadContract({
    ...token,
    functionName: "symbol",
    query: { enabled: onSupportedChain, refetchInterval: REALTIME_MS },
  });

  const { data: walletBal } = useReadContract({
    ...token,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: onSupportedChain && !!address, refetchInterval: REALTIME_MS },
  });

  const { data: openPrincipal } = useReadContract({
    ...staking,
    functionName: "totalOpenPrincipal",
    args: address ? [address] : undefined,
    query: { enabled: onSupportedChain && !!address, refetchInterval: REALTIME_MS },
  });

  const { data: posCount } = useReadContract({
    ...staking,
    functionName: "getUserPositionCount",
    args: address ? [address] : undefined,
    query: { enabled: onSupportedChain && !!address, refetchInterval: REALTIME_MS },
  });

  const { data: contractBal } = useReadContract({
    ...staking,
    functionName: "contractTokenBalance",
    query: { enabled: onSupportedChain, refetchInterval: REALTIME_MS },
  });

  const posIds = useMemo(() => {
    const n = Number(posCount ?? 0n);
    return Array.from({ length: n }, (_, i) => BigInt(i));
  }, [posCount]);

  const { data: positionData } = useReadContracts({
    contracts: address
      ? posIds.map((idx) => ({
          ...staking,
          functionName: "getUserPosition",
          args: [address, idx],
        }))
      : [],
    query: { enabled: onSupportedChain && !!address && posIds.length > 0, refetchInterval: REALTIME_MS },
  });

  const { data: pendingData } = useReadContracts({
    contracts: address
      ? posIds.map((idx) => ({
          ...staking,
          functionName: "pendingRewards",
          args: [address, idx],
        }))
      : [],
    query: { enabled: onSupportedChain && !!address && posIds.length > 0, refetchInterval: REALTIME_MS },
  });

  const positions = useMemo(() => {
    return posIds
      .map((idx, i) => {
        const p = unwrapReadResult(positionData?.[i]) as any;
        if (!p) return null;
        return {
          index: idx,
          amount: BigInt(p.amount),
          lockDuration: BigInt(p.lockDuration),
          aprBps: BigInt(p.aprBps),
          closed: Boolean(p.closed),
          pending: (unwrapReadResult(pendingData?.[i]) as bigint | undefined) ?? 0n,
        };
      })
      .filter(Boolean) as Array<{
        index: bigint;
        amount: bigint;
        lockDuration: bigint;
        aprBps: bigint;
        closed: boolean;
        pending: bigint;
      }>;
  }, [posIds, positionData, pendingData]);

  const openPositions = useMemo(() => positions.filter((p) => !p.closed), [positions]);
  const activePositions = openPositions.length;
  const totalPendingRewards = useMemo(
    () => openPositions.reduce((acc, p) => acc + p.pending, 0n),
    [openPositions],
  );
  const walletBalanceValue = !isConnected
    ? "Connect wallet"
    : !onSupportedChain
      ? "Switch network"
      : walletBal === undefined
        ? "Loading..."
        : `${formatToken(walletBal, tokenDecimals)} ${tokenSymbol ?? "Kom"}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          icon={<Coins className="h-4 w-4 text-brand-300" />}
          label="Total Staked"
          value={`${formatToken(openPrincipal, tokenDecimals)} ${tokenSymbol ?? "Kom"}`}
          hint="Across all open positions"
        />
        <StatCard
          icon={<Hourglass className="h-4 w-4 text-brand-300" />}
          label="Pending Rewards"
          value={`${formatToken(totalPendingRewards, tokenDecimals, PENDING_DIGITS)} ${tokenSymbol ?? "Kom"}`}
          hint="Across open positions; updates each new block"
        />
        <StatCard
          icon={<Layers className="h-4 w-4 text-brand-300" />}
          label="Active Positions"
          value={`${activePositions}`}
          hint="Currently earning yield"
        />
        <StatCard
          icon={<Wallet className="h-4 w-4 text-brand-300" />}
          label="Wallet Balance"
          value={walletBalanceValue}
          hint="Available to stake"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Your Staking Positions</div>
              <div className="mt-1 text-xs text-white/60">Open positions per wallet</div>
            </div>
            <Badge tone={isConnected ? "success" : "warn"}>
              {isConnected ? "Wallet connected" : "Connect wallet to view"}
            </Badge>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="hidden md:block">
              <div className="grid grid-cols-4 gap-0 bg-white/4 px-4 py-3 text-xs text-white/60">
                <div>Index</div>
                <div>Principal</div>
                <div>Pending</div>
                <div>APR / Lock</div>
              </div>
              {openPositions.length ? (
                openPositions.map((p) => (
                  <div key={p.index.toString()} className="grid grid-cols-4 items-center px-4 py-3 text-sm border-t border-white/10">
                    <div className="text-white/85">#{p.index.toString()}</div>
                    <div className="text-white/85">{formatToken(p.amount, tokenDecimals)} {tokenSymbol ?? "Kom"}</div>
                    <div className="text-white/85">{formatToken(p.pending, tokenDecimals, PENDING_DIGITS)} {tokenSymbol ?? "Kom"}</div>
                    <div className="text-white/75">{Number(p.aprBps) / 100}% / {formatLockDaysOnly(p.lockDuration)}</div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-10 text-center text-white/65">
                  No active positions yet. Go to <span className="text-white/80">Stake & Yield</span> to create your first position.
                </div>
              )}
            </div>

            <div className="space-y-3 p-3 md:hidden">
              {openPositions.length ? (
                openPositions.map((p) => (
                  <div key={p.index.toString()} className="rounded-xl border border-white/10 bg-white/4 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-white/90">Position #{p.index.toString()}</div>
                      <div className="text-xs text-white/70">{Number(p.aprBps) / 100}% APR</div>
                    </div>
                    <div className="mt-2 text-white/80">Principal: {formatToken(p.amount, tokenDecimals)} {tokenSymbol ?? "Kom"}</div>
                    <div className="mt-1 text-white/80">Pending: {formatToken(p.pending, tokenDecimals, PENDING_DIGITS)} {tokenSymbol ?? "Kom"}</div>
                    <div className="mt-1 text-white/70">Lock: {formatLockDaysOnly(p.lockDuration)}</div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-white/65">
                  No active positions yet. Go to <span className="text-white/80">Stake & Yield</span> to create your first position.
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold">Network Stats</div>
          <div className="mt-1 text-xs text-white/60">On-chain contract health</div>

          <div className="mt-5 space-y-3">
            <Row label="TVL (Total Value Locked)" value={`${formatToken(contractBal, tokenDecimals)} ${tokenSymbol ?? "Kom"}`} />
            <Row label="Active Yield Plans" value="See Stake & Yield" />
            <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
              <div className="text-xs text-white/60">Premium Yield Active</div>
              <div className="mt-2 text-sm text-white/75">
                Add plans from <span className="text-white/85">Admin Panel</span> to enable staking.
              </div>
            </div>
          </div>
        </Card>
      </div>

      {!onSupportedChain ? (
        <Card className="border border-red-500/20 bg-red-500/8">
          <div className="text-sm font-semibold text-red-100">Wrong network</div>
          <div className="mt-1 text-sm text-red-100/80">{wrongNetworkUserHint()}</div>
        </Card>
      ) : null}
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 border border-white/10">
          {icon}
        </div>
        <div className="text-xs text-white/55">{label}</div>
      </div>
      <div className="mt-3 text-xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-white/55">{hint}</div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-3 py-2">
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-sm text-white/85">{value}</div>
    </div>
  );
}

function formatLockDaysOnly(lockSeconds: bigint) {
  const s = Number(lockSeconds);
  if (!Number.isFinite(s) || s <= 0) return "0d";
  return `${Math.max(1, Math.floor(s / 86400))}d`;
}

function unwrapReadResult<T>(entry: unknown): T | undefined {
  if (entry && typeof entry === "object" && "result" in entry) {
    const result = (entry as { result?: T }).result;
    return result;
  }
  return entry as T | undefined;
}

