import { useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useContracts } from "../hooks/useContracts";
import { useInvalidateReadsOnNewBlock } from "../hooks/useInvalidateReadsOnNewBlock";
import { useAutoRefreshTx } from "../hooks/useAutoRefreshTx";
import { clampInt, formatToken } from "../lib/format";
import { ingestStakingTx } from "../lib/apiBackend";

type Plan = { id: bigint; lockDuration: bigint; aprBps: bigint; active: boolean };
const REALTIME_MS = 2000;
const PENDING_DIGITS = 6;

export function StakePage() {
  const { address, isConnected } = useAccount();
  const { staking, token, onSupportedChain } = useContracts();
  useInvalidateReadsOnNewBlock(onSupportedChain);
  const { writeContractAsync, isPending } = useWriteContract();
  const { run, mining } = useAutoRefreshTx();

  async function runStakingTx(send: () => Promise<`0x${string}`>) {
    const hash = await run(send);
    void ingestStakingTx(hash);
    return hash;
  }

  const { data: paused } = useReadContract({
    ...staking,
    functionName: "paused",
    query: { enabled: onSupportedChain, refetchInterval: REALTIME_MS },
  });

  const { data: tokenSymbol } = useReadContract({
    ...token,
    functionName: "symbol",
    query: { enabled: onSupportedChain, refetchInterval: REALTIME_MS },
  });
  const { data: decimals } = useReadContract({
    ...token,
    functionName: "decimals",
    query: { enabled: onSupportedChain, refetchInterval: REALTIME_MS },
  });
  const tokenDecimals = Number(decimals ?? 18);

  const { data: planCount } = useReadContract({
    ...staking,
    functionName: "planCount",
    query: { enabled: onSupportedChain, refetchInterval: REALTIME_MS },
  });

  // Load plans [0..planCount-1]
  const planIds = useMemo(() => {
    const n = Number(planCount ?? 0n);
    return Array.from({ length: n }, (_, i) => BigInt(i));
  }, [planCount]);

  const { data: planData } = useReadContracts({
    contracts: planIds.map((id) => ({
      ...staking,
      functionName: "getPlan",
      args: [id],
    })),
    query: { enabled: onSupportedChain && planIds.length > 0, refetchInterval: REALTIME_MS },
  });

  const plans: Plan[] = useMemo(() => {
    return planIds
      .map((id, idx) => {
        const p = unwrapReadResult(planData?.[idx]) as any;
        if (!p) return null;
        return { id, lockDuration: BigInt(p.lockDuration), aprBps: BigInt(p.aprBps), active: Boolean(p.active) };
      })
      .filter(Boolean) as Plan[];
  }, [planIds, planData]);

  const { data: posCount } = useReadContract({
    ...staking,
    functionName: "getUserPositionCount",
    args: address ? [address] : undefined,
    query: { enabled: onSupportedChain && !!address, refetchInterval: REALTIME_MS },
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
          stakeStart: BigInt(p.stakeStart),
          claimedRewards: BigInt(p.claimedRewards),
          lockDuration: BigInt(p.lockDuration),
          aprBps: BigInt(p.aprBps),
          closed: Boolean(p.closed),
          pending: (unwrapReadResult(pendingData?.[i]) as bigint | undefined) ?? 0n,
        };
      })
      .filter(Boolean) as Array<{
        index: bigint;
        amount: bigint;
        stakeStart: bigint;
        claimedRewards: bigint;
        lockDuration: bigint;
        aprBps: bigint;
        closed: boolean;
        pending: bigint;
      }>;
  }, [posIds, positionData, pendingData]);
  const openPositions = useMemo(() => positions.filter((p) => !p.closed), [positions]);

  const [selectedPlan, setSelectedPlan] = useState<string>("0");
  const [amount, setAmount] = useState<string>("");
  const [txStatus, setTxStatus] = useState<{
    tone: "neutral" | "success" | "error";
    message: string;
    hash?: `0x${string}`;
  } | null>(null);
  const amountWei = useMemo(() => {
    try {
      if (!amount) return 0n;
      return parseUnits(amount, tokenDecimals);
    } catch {
      return 0n;
    }
  }, [amount, tokenDecimals]);

  const { data: allowance } = useReadContract({
    ...token,
    functionName: "allowance",
    args: address ? [address, staking.address] : undefined,
    query: { enabled: onSupportedChain && !!address, refetchInterval: REALTIME_MS },
  });

  const needsApproval = (allowance ?? 0n) < amountWei && amountWei > 0n;

  async function doApprove() {
    try {
      setTxStatus({ tone: "neutral", message: "Submitting approve transaction..." });
      const hash = await run(
        () =>
          writeContractAsync({
            ...token,
            functionName: "approve",
            args: [staking.address, amountWei],
          }) as any,
      );
      setTxStatus({ tone: "success", message: "Approve confirmed on-chain.", hash });
    } catch (err) {
      setTxStatus({ tone: "error", message: getErrorMessage(err) });
    }
  }

  async function doStake() {
    try {
      setTxStatus({ tone: "neutral", message: "Submitting stake transaction..." });
      const hash = await runStakingTx(
        () =>
          writeContractAsync({
            ...staking,
            functionName: "stake",
            args: [BigInt(clampInt(selectedPlan)), amountWei],
          }) as Promise<`0x${string}`>,
      );
      setAmount("");
      setTxStatus({
        tone: "success",
        message: "Stake confirmed. Your position should appear below in a moment.",
        hash,
      });
    } catch (err) {
      setTxStatus({ tone: "error", message: getErrorMessage(err) });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {paused ? (
        <Card className="lg:col-span-3 border border-amber-300/15 bg-amber-400/8">
          <div className="text-sm font-semibold text-amber-100">Contract is paused</div>
          <div className="mt-1 text-sm text-amber-100/85">
            Staking, claiming, and unstaking are temporarily disabled by the owner.
          </div>
        </Card>
      ) : null}

      <Card className="lg:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Yield Plans</div>
            <div className="mt-1 text-xs text-white/60">Choose a plan and stake</div>
          </div>
          <Badge tone={plans.some((p) => p.active) ? "success" : "warn"}>
            {plans.some((p) => p.active) ? "Plans available" : "No active plans"}
          </Badge>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {plans.length ? (
            plans.map((p) => (
              <button
                key={p.id.toString()}
                onClick={() => setSelectedPlan(p.id.toString())}
                className={[
                  "text-left rounded-2xl border p-4 transition",
                  selectedPlan === p.id.toString()
                    ? "border-brand-400/40 bg-brand-500/10 shadow-glow"
                    : "border-white/10 bg-white/3 hover:bg-white/5",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Plan #{p.id.toString()}</div>
                  <Badge tone={p.active ? "success" : "warn"}>{p.active ? "Active" : "Inactive"}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white/4 border border-white/10 p-3">
                    <div className="text-xs text-white/60">APR</div>
                    <div className="mt-1 font-medium">{Number(p.aprBps) / 100}%</div>
                  </div>
                  <div className="rounded-xl bg-white/4 border border-white/10 p-3">
                    <div className="text-xs text-white/60">Lock</div>
                    <div className="mt-1 font-medium">{formatLock(p.lockDuration)}</div>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/3 p-6 text-white/70">
              No plans yet. Create one from <span className="text-white/85">Admin Panel</span>.
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="text-sm font-semibold">Stake</div>
        <div className="mt-1 text-xs text-white/60">Approve then stake into selected plan</div>

        <div className="mt-5 space-y-3">
          <div>
            <div className="text-xs text-white/60">Selected plan</div>
            <div className="mt-1 text-sm text-white/85">#{selectedPlan}</div>
          </div>

          <div>
            <div className="text-xs text-white/60">Amount ({tokenSymbol ?? "STK"})</div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-brand-400/50"
            />
          </div>

          {!isConnected ? (
            <div className="rounded-xl border border-white/10 bg-white/4 p-3 text-sm text-white/70">
              Connect wallet to stake.
            </div>
          ) : !onSupportedChain ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-3 text-sm text-red-100/85">
              Switch to Hardhat (31337).
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {needsApproval ? (
                <Button loading={isPending || mining} onClick={doApprove}>
                  Approve
                </Button>
              ) : (
                <Button loading={isPending || mining} onClick={doStake} disabled={amountWei <= 0n || !!paused}>
                  Stake
                </Button>
              )}
              <div className="text-xs text-white/55">
                Allowance: {formatToken(allowance ?? 0n, tokenDecimals)} {tokenSymbol ?? "STK"}
              </div>
              {txStatus ? (
                <div
                  className={[
                    "rounded-xl border p-3 text-xs",
                    txStatus.tone === "success"
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                      : txStatus.tone === "error"
                        ? "border-red-500/30 bg-red-500/10 text-red-100"
                        : "border-white/15 bg-white/5 text-white/80",
                  ].join(" ")}
                >
                  <div>{txStatus.message}</div>
                  {txStatus.hash ? (
                    <div className="mt-1 break-all text-[11px] text-white/70">Tx: {txStatus.hash}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Your Positions</div>
            <div className="mt-1 text-xs text-white/60">
              Claim rewards or unstake. Pending rewards follow block time (they change when a new block is mined).
            </div>
          </div>
          <Badge tone={openPositions.length ? "success" : "neutral"}>
            {openPositions.length} open
          </Badge>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10">
          <div className="hidden md:block">
            <div className="overflow-x-auto rounded-2xl">
              <div className="grid min-w-[820px] grid-cols-6 gap-0 bg-white/4 px-4 py-3 text-xs text-white/60">
              <div>Index</div>
              <div>Principal</div>
              <div>APR</div>
              <div>Lock</div>
              <div>Pending</div>
              <div className="text-right">Actions</div>
              </div>
              {openPositions.length ? (
                openPositions.map((p) => (
                  <div key={p.index.toString()} className="grid min-w-[820px] grid-cols-6 items-center px-4 py-3 text-sm border-t border-white/10">
                    <div className="text-white/85">#{p.index.toString()}</div>
                    <div className="text-white/85">{formatToken(p.amount, tokenDecimals)} {tokenSymbol ?? "STK"}</div>
                    <div className="text-white/85">{Number(p.aprBps) / 100}%</div>
                    <div className="text-white/75">{formatLock(p.lockDuration)}</div>
                    <div className="text-white/85">{formatToken(p.pending, tokenDecimals, PENDING_DIGITS)} {tokenSymbol ?? "STK"}</div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={isPending || mining}
                        disabled={!isConnected || !onSupportedChain || p.closed || p.pending === 0n || !!paused}
                        onClick={() =>
                          runStakingTx(
                            () =>
                              writeContractAsync({
                                ...staking,
                                functionName: "claimRewards",
                                args: [p.index],
                              }) as Promise<`0x${string}`>,
                          )
                        }
                      >
                        Claim
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={isPending || mining}
                        disabled={!isConnected || !onSupportedChain || p.closed || !!paused}
                        onClick={() =>
                          runStakingTx(
                            () =>
                              writeContractAsync({
                                ...staking,
                                functionName: "unstake",
                                args: [p.index],
                              }) as Promise<`0x${string}`>,
                          )
                        }
                      >
                        Unstake
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-10 text-center text-white/65">
                  No open positions.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {openPositions.length ? (
              openPositions.map((p) => (
                <div key={p.index.toString()} className="rounded-xl border border-white/10 bg-white/4 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white/90">Position #{p.index.toString()}</div>
                    <div className="text-xs text-white/70">{Number(p.aprBps) / 100}% APR</div>
                  </div>
                  <div className="mt-2 text-white/80">Principal: {formatToken(p.amount, tokenDecimals)} {tokenSymbol ?? "STK"}</div>
                  <div className="mt-1 text-white/80">Pending: {formatToken(p.pending, tokenDecimals, PENDING_DIGITS)} {tokenSymbol ?? "STK"}</div>
                  <div className="mt-1 text-white/70">Lock: {formatLock(p.lockDuration)}</div>
                  <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full min-w-0"
                      loading={isPending || mining}
                      disabled={!isConnected || !onSupportedChain || p.pending === 0n || !!paused}
                      onClick={() =>
                        runStakingTx(
                          () =>
                            writeContractAsync({
                              ...staking,
                              functionName: "claimRewards",
                              args: [p.index],
                            }) as Promise<`0x${string}`>,
                        )
                      }
                    >
                      Claim
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="w-full min-w-0"
                      loading={isPending || mining}
                      disabled={!isConnected || !onSupportedChain || !!paused}
                      onClick={() =>
                        runStakingTx(
                          () =>
                            writeContractAsync({
                              ...staking,
                              functionName: "unstake",
                              args: [p.index],
                            }) as Promise<`0x${string}`>,
                        )
                      }
                    >
                      Unstake
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-white/65">No open positions.</div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function formatLock(lockSeconds: bigint) {
  const s = Number(lockSeconds);
  if (!Number.isFinite(s) || s <= 0) return "0s";
  const days = Math.floor(s / 86400);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(s / 3600);
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor(s / 60);
  if (mins >= 1) return `${mins}m`;
  return `${s}s`;
}

function getErrorMessage(err: unknown) {
  const fallback = "Transaction failed. Please check wallet/network and try again.";
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (typeof err === "object" && "shortMessage" in err) {
    const shortMessage = (err as { shortMessage?: unknown }).shortMessage;
    if (typeof shortMessage === "string" && shortMessage.trim()) return shortMessage;
  }
  if (typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function unwrapReadResult<T>(entry: unknown): T | undefined {
  if (entry && typeof entry === "object" && "result" in entry) {
    const result = (entry as { result?: T }).result;
    return result;
  }
  return entry as T | undefined;
}

