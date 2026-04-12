const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");

function apiEnabled() {
  return Boolean(base);
}

async function post<T = unknown>(path: string, body: object): Promise<T | null> {
  if (!base) return null;
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return (await r.json()) as T;
}

async function get<T = unknown>(path: string, headers: Record<string, string>): Promise<T> {
  if (!base) throw new Error("VITE_API_URL not set");
  const r = await fetch(`${base}${path}`, { headers });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return (await r.json()) as T;
}

export function isBackendConfigured() {
  return apiEnabled();
}

export async function registerUser(address: string) {
  return post<{ ok: boolean }>("/api/users/register", { address });
}

export async function heartbeatUser(address: string) {
  return post<{ ok: boolean }>("/api/users/heartbeat", { address });
}

export async function logoutUser(address: string) {
  return post<{ ok: boolean }>("/api/users/logout", { address });
}

/** Persists stake / claim / unstake logs by reading the receipt from the backend RPC. */
export async function ingestStakingTx(txHash: `0x${string}`) {
  try {
    await post("/api/chain-events/ingest-tx", { txHash });
  } catch {
    /* non-fatal for UX */
  }
}

export type AdminUserRow = {
  address: string;
  registeredAt: number;
  lastSeenAt: number;
  status: "online" | "offline";
};

export type AdminStakingEventRow = {
  id: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  eventType: string;
  user: string;
  positionIndex: string | null;
  planId: string | null;
  amount: string | null;
  principal: string | null;
  rewardPaid: string | null;
  early: number | null;
  penaltyAppliedOnRewards: string | null;
  blockTimestamp: number | null;
  source: string;
};

export async function adminFetchUsers(adminKey: string) {
  return get<{ users: AdminUserRow[]; staleMs: number }>("/api/admin/users", {
    "X-Admin-Key": adminKey,
  });
}

export async function adminFetchStakingEvents(adminKey: string) {
  return get<{ events: AdminStakingEventRow[] }>("/api/admin/staking-events", {
    "X-Admin-Key": adminKey,
  });
}

export async function adminSyncSubgraph(adminKey: string) {
  if (!base) throw new Error("VITE_API_URL not set");
  const r = await fetch(`${base}/api/admin/sync-subgraph`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": adminKey,
    },
    body: "{}",
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return (await r.json()) as { ok: boolean; upserted: number };
}
