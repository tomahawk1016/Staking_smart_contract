import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatUnits, isAddressEqual } from "viem";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useContracts } from "../hooks/useContracts";
import { useAutoRefreshTx } from "../hooks/useAutoRefreshTx";
import { clampInt, shortAddr } from "../lib/format";
import { getPreferredChainId, wrongNetworkUserHint } from "../config/networkConfig";
import { getApiBase } from "../config/api";
import { useWalletBackendAuth } from "../context/WalletBackendAuthProvider";

type WalletUserRow = {
  walletAddress: string;
  registeredAt: string;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  state: "logged_in" | "logged_out";
};

type StakingActivityRow = {
  id: string;
  activityType: string;
  user: string;
  planId: string | null;
  positionIndex: string | null;
  amount: string | null;
  principal: string | null;
  rewardPaid: string | null;
  early: boolean | null;
  penaltyOnRewards: string | null;
  lockDuration: string | null;
  aprBps: string | null;
  planActive: boolean | null;
  penaltyBps: string | null;
  blockNumber: string;
  timestamp: string;
  txHash: string;
  logIndex: string;
};

const ACTIVITY_PAGE = 50;

export function AdminPage() {
  const { address, isConnected } = useAccount();
  const { token, jwtRole, isBackendAuthed } = useWalletBackendAuth();
  const [walletRows, setWalletRows] = useState<WalletUserRow[]>([]);
  const [walletUsersLoading, setWalletUsersLoading] = useState(false);
  const [walletUsersError, setWalletUsersError] = useState<string | null>(null);

  const [activityRows, setActivityRows] = useState<StakingActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityHasMore, setActivityHasMore] = useState(false);

  useEffect(() => {
    if (!token || jwtRole !== "admin" || !isBackendAuthed) {
      setWalletRows([]);
      setWalletUsersError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setWalletUsersLoading(true);
      setWalletUsersError(null);
      try {
        const res = await fetch(`${getApiBase()}/admin/wallet-users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as WalletUserRow[];
        if (!cancelled) setWalletRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setWalletUsersError(e instanceof Error ? e.message : "Failed to load wallet users.");
          setWalletRows([]);
        }
      } finally {
        if (!cancelled) setWalletUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, jwtRole, isBackendAuthed]);

  useEffect(() => {
    if (!token || jwtRole !== "admin" || !isBackendAuthed) {
      setActivityRows([]);
      setActivityError(null);
      setActivityHasMore(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setActivityLoading(true);
      setActivityError(null);
      try {
        const res = await fetch(
          `${getApiBase()}/admin/staking-activities?first=${ACTIVITY_PAGE}&skip=0`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as StakingActivityRow[];
        const list = Array.isArray(data) ? data : [];
        if (!cancelled) {
          setActivityRows(list);
          setActivityHasMore(list.length === ACTIVITY_PAGE);
        }
      } catch (e) {
        if (!cancelled) {
          setActivityError(e instanceof Error ? e.message : "Failed to load on-chain activity.");
          setActivityRows([]);
          setActivityHasMore(false);
        }
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, jwtRole, isBackendAuthed]);

  async function loadMoreActivities() {
    if (!token || jwtRole !== "admin" || !isBackendAuthed || activityLoading) return;
    setActivityLoading(true);
    setActivityError(null);
    try {
      const skip = activityRows.length;
      const res = await fetch(
        `${getApiBase()}/admin/staking-activities?first=${ACTIVITY_PAGE}&skip=${skip}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as StakingActivityRow[];
      const list = Array.isArray(data) ? data : [];
      setActivityRows((prev) => [...prev, ...list]);
      setActivityHasMore(list.length === ACTIVITY_PAGE);
    } catch (e) {
      setActivityError(e instanceof Error ? e.message : "Failed to load more.");
    } finally {
      setActivityLoading(false);
    }
  }
  const { staking, onSupportedChain } = useContracts();
  const { writeContractAsync, isPending } = useWriteContract();
  const { run, mining } = useAutoRefreshTx();

  const { data: paused } = useReadContract({
    ...staking,
    functionName: "paused",
    query: { enabled: onSupportedChain },
  });

  const {
    data: owner,
    isLoading: ownerLoading,
    error: ownerError,
  } = useReadContract({
    ...staking,
    functionName: "owner",
    query: { enabled: onSupportedChain },
  });

  const isOwner = useMemo(() => {
    if (!address || !owner) return false;
    return isAddressEqual(address, owner);
  }, [address, owner]);

  const { data: planCount } = useReadContract({
    ...staking,
    functionName: "planCount",
    query: { enabled: onSupportedChain },
  });

  const { data: penaltyBps } = useReadContract({
    ...staking,
    functionName: "earlyUnstakePenaltyBps",
    query: { enabled: onSupportedChain },
  });

  const [newLockDays, setNewLockDays] = useState("30");
  const [newAprBps, setNewAprBps] = useState("800");

  const [updPlanId, setUpdPlanId] = useState("0");
  const [updLockDays, setUpdLockDays] = useState("30");
  const [updAprBps, setUpdAprBps] = useState("800");

  const [actPlanId, setActPlanId] = useState("0");
  const [actActive, setActActive] = useState(true);

  const [newPenalty, setNewPenalty] = useState("1000");

  async function addPlan() {
    const lock = BigInt(clampInt(newLockDays)) * 86400n;
    const apr = BigInt(clampInt(newAprBps));
    await run(() => writeContractAsync({ ...staking, functionName: "addedPlan", args: [lock, apr] }) as any);
  }

  async function updatePlan() {
    const planId = BigInt(clampInt(updPlanId));
    const lock = BigInt(clampInt(updLockDays)) * 86400n;
    const apr = BigInt(clampInt(updAprBps));
    await run(() => writeContractAsync({ ...staking, functionName: "updatedPlan", args: [planId, lock, apr] }) as any);
  }

  async function activatePlan() {
    const planId = BigInt(clampInt(actPlanId));
    await run(() => writeContractAsync({ ...staking, functionName: "activedPlan", args: [planId, actActive] }) as any);
  }

  async function setPenalty() {
    const bps = BigInt(clampInt(newPenalty));
    await run(() => writeContractAsync({ ...staking, functionName: "setEarlyUnstakePenaltyBps", args: [bps] }) as any);
  }

  async function togglePause() {
    if (paused) {
      await run(() => writeContractAsync({ ...staking, functionName: "unpause" }) as any);
    } else {
      await run(() => writeContractAsync({ ...staking, functionName: "pause" }) as any);
    }
  }

  return (
    <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Admin Controls</div>
            <div className="mt-1 text-xs text-white/60">Owner-only functions</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={paused ? "warn" : "success"}>{paused ? "Paused" : "Live"}</Badge>
            <Badge tone={ownerLoading ? "neutral" : isOwner ? "success" : "warn"}>
              {ownerLoading ? "Checking owner..." : isOwner ? "Owner connected" : "Not owner"}
            </Badge>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/4 p-4">
          <div className="text-xs text-white/60">Admin Address (Contract Owner)</div>
          <div className="mt-2 break-all text-sm text-white/90">
            {ownerLoading ? "Loading owner address..." : String(owner ?? "—")}
          </div>
        </div>

        {!isConnected ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/4 p-4 text-sm text-white/70">
            Connect a wallet to access admin.
          </div>
        ) : !onSupportedChain ? (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-100/85">
            {wrongNetworkUserHint()}
          </div>
        ) : ownerLoading ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/4 p-4 text-sm text-white/75">
            Verifying contract owner...
          </div>
        ) : ownerError ? (
          <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-100/85">
            Could not verify owner from contract. Reconnect wallet or refresh the page.
          </div>
        ) : !isOwner ? (
          <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-400/8 p-4 text-sm text-amber-100/85">
            Admin functions require the contract <span className="font-medium">owner</span> wallet — the address that
            deployed or was set as owner in <span className="font-medium">initialize(...)</span>.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Section title="Pause / Unpause" subtitle="Emergency stop for user actions">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
                Status: <span className="text-white/90 font-medium">{paused ? "Paused" : "Live"}</span>
              </div>
              <Button loading={isPending || mining} onClick={togglePause} variant={paused ? "primary" : "danger"}>
                {paused ? "Unpause" : "Pause"}
              </Button>
              <div className="text-xs text-white/60">
                When paused, staking/claim/unstake are blocked.
              </div>
            </Section>

            <Section title="Add plan" subtitle="Creates a new plan (active=true)">
              <LabeledInput label="Lock (days)" value={newLockDays} onChange={setNewLockDays} />
              <LabeledInput label="APR (bps) (e.g. 800 = 8%)" value={newAprBps} onChange={setNewAprBps} />
              <Button loading={isPending || mining} onClick={addPlan}>
                Add plan
              </Button>
            </Section>

            <Section title="Update plan" subtitle="Affects new stakes only">
              <LabeledInput label="Plan ID" value={updPlanId} onChange={setUpdPlanId} />
              <LabeledInput label="Lock (days)" value={updLockDays} onChange={setUpdLockDays} />
              <LabeledInput label="APR (bps) (e.g. 800 = 8%)" value={updAprBps} onChange={setUpdAprBps} />
              <Button loading={isPending || mining} onClick={updatePlan}>
                Update plan
              </Button>
            </Section>

            <Section title="Activate / Deactivate" subtitle="Enable/disable accepting new stakes">
              <LabeledInput label="Plan ID" value={actPlanId} onChange={setActPlanId} />
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-sm text-white/75">Active</div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={actActive}
                    onChange={(e) => setActActive(e.target.checked)}
                  />
                </label>
              </div>
              <Button loading={isPending || mining} onClick={activatePlan}>
                Apply
              </Button>
            </Section>

            <Section title="Early-unstake penalty" subtitle="Bps applied to rewards only (0–10000)">
              <LabeledInput label="Penalty (bps) (e.g. 1000 = 10%)" value={newPenalty} onChange={setNewPenalty} />
              <Button loading={isPending || mining} onClick={setPenalty}>
                Set penalty
              </Button>
              <div className="text-xs text-white/60">
                Current: {String(penaltyBps ?? 0n)} bps
              </div>
            </Section>
          </div>
        )}
      </Card>

      <Card>
        <div className="text-sm font-semibold">Local Info</div>
        <div className="mt-1 text-xs text-white/60">Contract + network</div>

        <div className="mt-5 space-y-3">
          <Row label="Connected wallet" value={String(address ?? "—")} />
          <Row label="Owner" value={String(owner ?? "—")} />
          <Row label="Owner match" value={ownerLoading ? "checking..." : isOwner ? "true" : "false"} />
          <Row label="Paused" value={paused ? "true" : "false"} />
          <Row label="Plan count" value={String(planCount ?? "—")} />
          <Row label="Penalty (bps)" value={String(penaltyBps ?? "—")} />
          <div className="rounded-2xl border border-white/10 bg-white/4 p-4 text-sm text-white/75">
            If MetaMask shows no accounts, import the correct account or use the wallet’s account list.
          </div>
        </div>
      </Card>
    </div>

    {jwtRole === "admin" && isBackendAuthed ? (
      <>
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Wallet logins</div>
              <div className="mt-1 text-xs text-white/60">
                Users who completed wallet verification. State reflects an active server session (JWT not logged out and
                not expired).
              </div>
            </div>
            <Badge tone="success">Backend admin</Badge>
          </div>

          {walletUsersLoading ? (
            <div className="mt-5 text-sm text-white/70">Loading wallet users…</div>
          ) : walletUsersError ? (
            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-100/85">
              {walletUsersError}
            </div>
          ) : walletRows.length === 0 ? (
            <div className="mt-5 text-sm text-white/70">No registered wallets yet.</div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-white/55">
                  <tr>
                    <th className="px-3 py-3 font-medium">Wallet</th>
                    <th className="px-3 py-3 font-medium">Registered</th>
                    <th className="px-3 py-3 font-medium">Last login</th>
                    <th className="px-3 py-3 font-medium">Last logout</th>
                    <th className="px-3 py-3 font-medium">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {walletRows.map((row) => (
                    <tr key={row.walletAddress} className="bg-white/[0.02]">
                      <td className="px-3 py-3 font-mono text-xs text-white/90">{row.walletAddress}</td>
                      <td className="px-3 py-3 text-xs text-white/75">{formatTs(row.registeredAt)}</td>
                      <td className="px-3 py-3 text-xs text-white/75">{row.lastLoginAt ? formatTs(row.lastLoginAt) : "—"}</td>
                      <td className="px-3 py-3 text-xs text-white/75">
                        {row.lastLogoutAt ? formatTs(row.lastLogoutAt) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={row.state === "logged_in" ? "success" : "neutral"}>
                          {row.state === "logged_in" ? "Logged in" : "Logged out"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold">On-chain activity (The Graph)</div>
              <div className="mt-1 text-xs text-white/60">
                Stake, claim, unstake, and owner plan changes — indexed by the subgraph. Fetched only through your API so
                the Studio URL stays server-side.
              </div>
            </div>
            <Badge tone="neutral">Subgraph</Badge>
          </div>

          {activityLoading && activityRows.length === 0 ? (
            <div className="mt-5 text-sm text-white/70">Loading activity…</div>
          ) : activityError ? (
            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-100/85">
              {activityError}
            </div>
          ) : activityRows.length === 0 ? (
            <div className="mt-5 text-sm text-white/70">No indexed events yet (or subgraph not deployed / wrong start block).</div>
          ) : (
            <>
              <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-white/55">
                    <tr>
                      <th className="px-3 py-3 font-medium">Time</th>
                      <th className="px-3 py-3 font-medium">Type</th>
                      <th className="px-3 py-3 font-medium">Account</th>
                      <th className="px-3 py-3 font-medium">Details</th>
                      <th className="px-3 py-3 font-medium">Tx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {activityRows.map((row) => (
                      <tr key={row.id} className="bg-white/[0.02]">
                        <td className="px-3 py-3 whitespace-nowrap text-xs text-white/75">
                          {formatTsFromUnix(row.timestamp)}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={activityBadgeTone(row.activityType)}>{activityTypeLabel(row.activityType)}</Badge>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-white/90">{shortAddr(row.user)}</td>
                        <td className="px-3 py-3 text-xs text-white/75">{activityDetails(row)}</td>
                        <td className="px-3 py-3">
                          <a
                            href={txExplorerHref(row.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-brand-300 hover:text-brand-200 underline"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {activityLoading && activityRows.length > 0 ? (
                <div className="mt-3 text-center text-xs text-white/55">Loading more…</div>
              ) : null}
              {activityHasMore ? (
                <div className="mt-4 flex justify-center">
                  <Button variant="ghost" size="sm" loading={activityLoading} onClick={() => void loadMoreActivities()}>
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </Card>
      </>
    ) : null}
    </div>
  );
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatTsFromUnix(seconds: string): string {
  try {
    const ms = Number(BigInt(seconds)) * 1000;
    return new Date(ms).toLocaleString();
  } catch {
    return seconds;
  }
}

function weiStr(s: string | null | undefined): string {
  if (s == null || s === "") return "—";
  try {
    return formatUnits(BigInt(s), 18);
  } catch {
    return s;
  }
}

function activityTypeLabel(t: string): string {
  const m: Record<string, string> = {
    STAKE: "Stake",
    CLAIM: "Claim",
    UNSTAKE: "Unstake",
    ADD_PLAN: "Add plan",
    UPDATE_PLAN: "Update plan",
    SET_PLAN_ACTIVE: "Plan active",
    SET_PENALTY_BPS: "Penalty bps",
  };
  return m[t] ?? t;
}

function activityBadgeTone(t: string): "neutral" | "success" | "warn" {
  if (t === "STAKE" || t === "CLAIM") return "success";
  if (t === "UNSTAKE") return "warn";
  return "neutral";
}

function activityDetails(row: StakingActivityRow): string {
  switch (row.activityType) {
    case "STAKE":
      return `plan ${row.planId ?? "—"} · pos ${row.positionIndex ?? "—"} · ${weiStr(row.amount)} token`;
    case "CLAIM":
      return `pos ${row.positionIndex ?? "—"} · ${weiStr(row.amount)} token`;
    case "UNSTAKE": {
      const pen =
        row.penaltyOnRewards && row.penaltyOnRewards !== "0"
          ? ` · penalty ${weiStr(row.penaltyOnRewards)}`
          : "";
      return `pos ${row.positionIndex ?? "—"} · principal ${weiStr(row.principal)} · reward ${weiStr(row.rewardPaid)}${
        row.early ? " · early" : ""
      }${pen}`;
    }
    case "ADD_PLAN":
      return `plan ${row.planId ?? "—"} · lock ${row.lockDuration ?? "—"}s · APR ${row.aprBps ?? "—"} bps`;
    case "UPDATE_PLAN":
      return `plan ${row.planId ?? "—"} · lock ${row.lockDuration ?? "—"}s · APR ${row.aprBps ?? "—"} bps`;
    case "SET_PLAN_ACTIVE":
      return `plan ${row.planId ?? "—"} · active ${row.planActive === null ? "—" : String(row.planActive)}`;
    case "SET_PENALTY_BPS":
      return `penalty ${row.penaltyBps ?? "—"} bps`;
    default:
      return "—";
  }
}

function txExplorerHref(txHash: string): string {
  const id = getPreferredChainId();
  if (id === 11155111) return `https://sepolia.etherscan.io/tx/${txHash}`;
  if (id === 1) return `https://etherscan.io/tx/${txHash}`;
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-white/60">{subtitle}</div>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-xs text-white/60">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-brand-400/50"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-3 py-2">
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-xs text-white/80 truncate max-w-[220px] text-right">{value}</div>
    </div>
  );
}

