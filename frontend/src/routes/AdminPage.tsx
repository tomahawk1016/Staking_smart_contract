import { useCallback, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { isAddressEqual } from "viem";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useContracts } from "../hooks/useContracts";
import { useAutoRefreshTx } from "../hooks/useAutoRefreshTx";
import { clampInt } from "../lib/format";
import {
  adminFetchStakingEvents,
  adminFetchUsers,
  adminSyncSubgraph,
  isBackendConfigured,
  type AdminStakingEventRow,
  type AdminUserRow,
} from "../lib/apiBackend";

export function AdminPage() {
  const { address, isConnected } = useAccount();
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
            Switch to Hardhat (31337).
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
            Admin functions require the contract owner. Your local deployer address (from Hardhat node) is the owner.
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
            If MetaMask shows no accounts, add Hardhat local accounts or connect using the account list.
          </div>
        </div>
      </Card>
    </div>
    {isBackendConfigured() ? <BackendAdminDashboard /> : null}
    </div>
  );
}

function BackendAdminDashboard() {
  const [adminKey, setAdminKey] = useState(() => {
    if (typeof localStorage === "undefined") return "";
    return (
      localStorage.getItem("stakingAdminKey") ??
      (import.meta.env.VITE_ADMIN_API_KEY as string | undefined) ??
      ""
    );
  });
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [events, setEvents] = useState<AdminStakingEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const key = adminKey.trim();
    if (!key) {
      setErr("Enter the backend ADMIN_API_KEY.");
      return;
    }
    setErr(null);
    setSyncMsg(null);
    setLoading(true);
    try {
      const [u, e] = await Promise.all([adminFetchUsers(key), adminFetchStakingEvents(key)]);
      setUsers(u.users);
      setEvents(e.events);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  async function syncFromSubgraph() {
    const key = adminKey.trim();
    if (!key) {
      setErr("Enter the backend ADMIN_API_KEY.");
      return;
    }
    setErr(null);
    setSyncMsg(null);
    setSyncing(true);
    try {
      const r = await adminSyncSubgraph(key);
      setSyncMsg(`Synced ${r.upserted} rows from subgraph.`);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  function persistKey() {
    localStorage.setItem("stakingAdminKey", adminKey);
  }

  return (
    <Card>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Users & staking activity (backend)</div>
          <div className="mt-1 text-xs text-white/60">
            Loaded from the API database. Uses <code className="text-white/80">X-Admin-Key</code> (same value as backend{" "}
            <code className="text-white/80">ADMIN_API_KEY</code>).
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <div className="text-xs text-white/60">Admin API key</div>
          <input
            type="password"
            autoComplete="off"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-brand-400/50"
            placeholder="ADMIN_API_KEY from backend .env"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={persistKey}>
          Save key in browser
        </Button>
        <Button loading={loading} onClick={() => void load()}>
          Refresh data
        </Button>
        <Button loading={syncing} variant="ghost" onClick={() => void syncFromSubgraph()}>
          Sync from The Graph
        </Button>
      </div>

      {err ? (
        <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-100/90">{err}</div>
      ) : null}
      {syncMsg ? (
        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100/90">
          {syncMsg}
        </div>
      ) : null}

      <div className="mt-6">
        <div className="text-xs font-medium text-white/70">Registered wallets ({users.length})</div>
        <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-white/55">
              <tr>
                <th className="px-3 py-2 font-medium">Address</th>
                <th className="px-3 py-2 font-medium">Registered</th>
                <th className="px-3 py-2 font-medium">Last seen</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? (
                users.map((u) => (
                  <tr key={u.address} className="border-b border-white/10 text-white/85">
                    <td className="px-3 py-2 font-mono">{u.address}</td>
                    <td className="px-3 py-2 text-white/70">{fmtTs(u.registeredAt)}</td>
                    <td className="px-3 py-2 text-white/70">{fmtTs(u.lastSeenAt)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={u.status === "online" ? "success" : "neutral"}>{u.status}</Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-white/55">
                    No rows yet. Connect a wallet (with backend running) and click Refresh.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <div className="text-xs font-medium text-white/70">Staking transactions ({events.length})</div>
        <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="border-b border-white/10 bg-white/5 text-white/55">
              <tr>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Tx</th>
                <th className="px-3 py-2 font-medium">Block</th>
                <th className="px-3 py-2 font-medium">Details</th>
                <th className="px-3 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {events.length ? (
                events.map((ev) => (
                  <tr key={ev.id} className="border-b border-white/10 text-white/85">
                    <td className="px-3 py-2 uppercase text-white/80">{ev.eventType}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{ev.user}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-white/70">{ev.txHash.slice(0, 12)}…</td>
                    <td className="px-3 py-2 text-white/70">{ev.blockNumber}</td>
                    <td className="px-3 py-2 text-white/70">{eventDetails(ev)}</td>
                    <td className="px-3 py-2 text-white/55">{ev.source}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-white/55">
                    No staking events stored yet. Stake/claim/unstake with the backend running, or sync from The Graph.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

function fmtTs(ms: number) {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

function eventDetails(ev: AdminStakingEventRow): string {
  if (ev.eventType === "stake") {
    return `plan ${ev.planId ?? "—"} · amount ${ev.amount ?? "—"} · pos ${ev.positionIndex ?? "—"}`;
  }
  if (ev.eventType === "claim") {
    return `amount ${ev.amount ?? "—"} · pos ${ev.positionIndex ?? "—"}`;
  }
  if (ev.eventType === "unstake") {
    return `principal ${ev.principal ?? "—"} · reward ${ev.rewardPaid ?? "—"} · early ${ev.early === 1 ? "yes" : "no"}`;
  }
  return "—";
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

