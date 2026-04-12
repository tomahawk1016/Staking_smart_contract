import { useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { isAddressEqual } from "viem";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useContracts } from "../hooks/useContracts";
import { useAutoRefreshTx } from "../hooks/useAutoRefreshTx";
import { clampInt } from "../lib/format";
import { wrongNetworkUserHint } from "../config/networkConfig";

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
    </div>
  );
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

