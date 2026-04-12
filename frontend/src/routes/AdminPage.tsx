import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { isAddressEqual } from "viem";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useContracts } from "../hooks/useContracts";
import { useAutoRefreshTx } from "../hooks/useAutoRefreshTx";
import { clampInt } from "../lib/format";
import { wrongNetworkUserHint } from "../config/networkConfig";
import { getApiBase } from "../config/api";
import { useWalletBackendAuth } from "../context/WalletBackendAuthProvider";

type WalletUserRow = {
  walletAddress: string;
  registeredAt: string;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  state: "logged_in" | "logged_out";
};

export function AdminPage() {
  const { address, isConnected } = useAccount();
  const { token, jwtRole, isBackendAuthed } = useWalletBackendAuth();
  const [walletRows, setWalletRows] = useState<WalletUserRow[]>([]);
  const [walletUsersLoading, setWalletUsersLoading] = useState(false);
  const [walletUsersError, setWalletUsersError] = useState<string | null>(null);

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

