import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createPublicClient, http, parseEventLogs, getAddress, isAddress } from "viem";
import { openDatabase } from "./db.js";
import { stakingEventsAbi } from "./stakingEventsAbi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 4000);
const ADMIN_KEY = process.env.ADMIN_API_KEY || "";
const STAKING_ADDRESS = (process.env.STAKING_ADDRESS || "").trim();
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const GRAPH_SUBGRAPH_URL = (process.env.GRAPH_SUBGRAPH_URL || "").trim();
const STALE_MS = Number(process.env.HEARTBEAT_STALE_MS || 180_000);
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "app.db");
const db = openDatabase(dbPath);

const publicClient = createPublicClient({
  transport: http(RPC_URL),
});

const app = express();
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || CORS_ORIGINS.includes("*") || CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  }),
);
app.use(express.json({ limit: "64kb" }));

function requireAdmin(req, res, next) {
  const key = req.header("x-admin-key") || "";
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function normalizeAddr(a) {
  if (!a || !isAddress(a)) throw new Error("invalid_address");
  return getAddress(a).toLowerCase();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, stakingConfigured: Boolean(STAKING_ADDRESS), graphConfigured: Boolean(GRAPH_SUBGRAPH_URL) });
});

app.post("/api/users/register", (req, res) => {
  try {
    const address = normalizeAddr(req.body?.address);
    const now = Date.now();
    const existing = db.prepare("SELECT address FROM users WHERE address = ?").get(address);
    if (!existing) {
      db.prepare(
        "INSERT INTO users (address, created_at, last_seen_at, is_online) VALUES (?, ?, ?, 1)",
      ).run(address, now, now);
    } else {
      db.prepare("UPDATE users SET last_seen_at = ?, is_online = 1 WHERE address = ?").run(now, address);
    }
    res.json({ ok: true, address, created: !existing });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/api/users/heartbeat", (req, res) => {
  try {
    const address = normalizeAddr(req.body?.address);
    const now = Date.now();
    const info = db.prepare("SELECT address FROM users WHERE address = ?").get(address);
    if (!info) {
      db.prepare(
        "INSERT INTO users (address, created_at, last_seen_at, is_online) VALUES (?, ?, ?, 1)",
      ).run(address, now, now);
    } else {
      db.prepare("UPDATE users SET last_seen_at = ?, is_online = 1 WHERE address = ?").run(now, address);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/api/users/logout", (req, res) => {
  try {
    const address = normalizeAddr(req.body?.address);
    db.prepare("UPDATE users SET is_online = 0 WHERE address = ?").run(address);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.get("/api/admin/users", requireAdmin, (_req, res) => {
  const now = Date.now();
  const rows = db
    .prepare(
      "SELECT address, created_at AS registeredAt, last_seen_at AS lastSeenAt, is_online AS dbOnline FROM users ORDER BY created_at DESC",
    )
    .all();
  const users = rows.map((u) => {
    const appearsOnline = Boolean(u.dbOnline) && now - u.lastSeenAt < STALE_MS;
    return {
      address: u.address,
      registeredAt: u.registeredAt,
      lastSeenAt: u.lastSeenAt,
      status: appearsOnline ? "online" : "offline",
    };
  });
  res.json({ users, staleMs: STALE_MS });
});

app.get("/api/admin/staking-events", requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, tx_hash AS txHash, log_index AS logIndex, block_number AS blockNumber,
              event_type AS eventType, user_address AS user, position_index AS positionIndex,
              plan_id AS planId, amount, principal, reward_paid AS rewardPaid, early,
              penalty_rewards AS penaltyAppliedOnRewards, block_timestamp AS blockTimestamp, source
       FROM staking_events ORDER BY block_number DESC, log_index DESC LIMIT 5000`,
    )
    .all();
  res.json({ events: rows });
});

function stakingAddrLower() {
  if (!STAKING_ADDRESS) return null;
  try {
    return getAddress(STAKING_ADDRESS).toLowerCase();
  } catch {
    return null;
  }
}

function upsertStakingEvent(row) {
  const stmt = db.prepare(`
    INSERT INTO staking_events (
      id, tx_hash, log_index, block_number, event_type, user_address,
      position_index, plan_id, amount, principal, reward_paid, early, penalty_rewards, block_timestamp, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      block_number = excluded.block_number,
      block_timestamp = COALESCE(excluded.block_timestamp, staking_events.block_timestamp),
      source = excluded.source
  `);
  stmt.run(
    row.id,
    row.tx_hash,
    row.log_index,
    row.block_number,
    row.event_type,
    row.user_address,
    row.position_index,
    row.plan_id,
    row.amount,
    row.principal,
    row.reward_paid,
    row.early,
    row.penalty_rewards,
    row.block_timestamp,
    row.source,
  );
}

app.post("/api/chain-events/ingest-tx", async (req, res) => {
  const stakingLower = stakingAddrLower();
  if (!stakingLower) {
    return res.status(503).json({ error: "STAKING_ADDRESS not configured on server" });
  }
  const txHash = req.body?.txHash;
  if (!txHash || typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return res.status(400).json({ error: "invalid_txHash" });
  }
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (!receipt) return res.status(404).json({ error: "receipt_not_found" });

    const canonicalHash = receipt.transactionHash.toLowerCase();

    const relevant = receipt.logs.filter(
      (log) => log.address && log.address.toLowerCase() === stakingLower,
    );
    if (!relevant.length) {
      return res.json({ ok: true, inserted: 0, message: "no_staking_logs" });
    }

    let blockTimestamp = null;
    try {
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
      blockTimestamp = Number(block.timestamp) * 1000;
    } catch {
      blockTimestamp = null;
    }

    const decoded = parseEventLogs({
      abi: stakingEventsAbi,
      logs: relevant,
    });

    let inserted = 0;
    for (const ev of decoded) {
      const id = `${canonicalHash}-${ev.logIndex}`;
      const base = {
        id,
        tx_hash: canonicalHash,
        log_index: ev.logIndex,
        block_number: Number(receipt.blockNumber),
        user_address: "",
        position_index: null,
        plan_id: null,
        amount: null,
        principal: null,
        reward_paid: null,
        early: null,
        penalty_rewards: null,
        block_timestamp: blockTimestamp,
        source: "rpc",
      };

      if (ev.eventName === "Staked") {
        base.event_type = "stake";
        base.user_address = getAddress(ev.args.user).toLowerCase();
        base.position_index = ev.args.positionIndex.toString();
        base.plan_id = ev.args.planId.toString();
        base.amount = ev.args.amount.toString();
      } else if (ev.eventName === "RewardClaimed") {
        base.event_type = "claim";
        base.user_address = getAddress(ev.args.user).toLowerCase();
        base.position_index = ev.args.positionIndex.toString();
        base.amount = ev.args.amount.toString();
      } else if (ev.eventName === "Unstaked") {
        base.event_type = "unstake";
        base.user_address = getAddress(ev.args.user).toLowerCase();
        base.position_index = ev.args.positionIndex.toString();
        base.principal = ev.args.principal.toString();
        base.reward_paid = ev.args.rewardPaid.toString();
        base.early = ev.args.early ? 1 : 0;
        base.penalty_rewards = ev.args.penaltyAppliedOnRewards.toString();
      } else {
        continue;
      }

      upsertStakingEvent(base);
      inserted += 1;
    }

    res.json({ ok: true, inserted });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

async function gqlSubgraph(query) {
  const r = await fetch(GRAPH_SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`subgraph_http_${r.status}`);
  const body = await r.json();
  if (body.errors?.length) throw new Error(body.errors.map((x) => x.message).join("; "));
  return body.data;
}

app.post("/api/admin/sync-subgraph", requireAdmin, async (_req, res) => {
  if (!GRAPH_SUBGRAPH_URL) {
    return res.status(503).json({ error: "GRAPH_SUBGRAPH_URL not set" });
  }
  const q = `
    query {
      stakeEvents(first: 1000, orderBy: blockNumber, orderDirection: asc) {
        id user positionIndex planId amount blockNumber txHash timestamp
      }
      claimEvents(first: 1000, orderBy: blockNumber, orderDirection: asc) {
        id user positionIndex amount blockNumber txHash timestamp
      }
      unstakeEvents(first: 1000, orderBy: blockNumber, orderDirection: asc) {
        id user positionIndex principal rewardPaid early penaltyAppliedOnRewards blockNumber txHash timestamp
      }
    }
  `;
  try {
    const data = await gqlSubgraph(q);
    let n = 0;

    for (const e of data.stakeEvents || []) {
      const txHash = String(e.txHash).toLowerCase();
      const logIndex = Number(String(e.id).split("-").pop() || 0);
      upsertStakingEvent({
        id: e.id,
        tx_hash: txHash,
        log_index: logIndex,
        block_number: Number(e.blockNumber),
        event_type: "stake",
        user_address: String(e.user).toLowerCase(),
        position_index: String(e.positionIndex),
        plan_id: String(e.planId),
        amount: String(e.amount),
        principal: null,
        reward_paid: null,
        early: null,
        penalty_rewards: null,
        block_timestamp: Number(e.timestamp) * 1000,
        source: "subgraph",
      });
      n += 1;
    }
    for (const e of data.claimEvents || []) {
      const txHash = String(e.txHash).toLowerCase();
      const logIndex = Number(String(e.id).split("-").pop() || 0);
      upsertStakingEvent({
        id: e.id,
        tx_hash: txHash,
        log_index: logIndex,
        block_number: Number(e.blockNumber),
        event_type: "claim",
        user_address: String(e.user).toLowerCase(),
        position_index: String(e.positionIndex),
        plan_id: null,
        amount: String(e.amount),
        principal: null,
        reward_paid: null,
        early: null,
        penalty_rewards: null,
        block_timestamp: Number(e.timestamp) * 1000,
        source: "subgraph",
      });
      n += 1;
    }
    for (const e of data.unstakeEvents || []) {
      const txHash = String(e.txHash).toLowerCase();
      const logIndex = Number(String(e.id).split("-").pop() || 0);
      upsertStakingEvent({
        id: e.id,
        tx_hash: txHash,
        log_index: logIndex,
        block_number: Number(e.blockNumber),
        event_type: "unstake",
        user_address: String(e.user).toLowerCase(),
        position_index: String(e.positionIndex),
        plan_id: null,
        amount: null,
        principal: String(e.principal),
        reward_paid: String(e.rewardPaid),
        early: e.early ? 1 : 0,
        penalty_rewards: String(e.penaltyAppliedOnRewards),
        block_timestamp: Number(e.timestamp) * 1000,
        source: "subgraph",
      });
      n += 1;
    }

    res.json({ ok: true, upserted: n });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`staking-backend listening on :${PORT}`);
  if (!ADMIN_KEY) console.warn("ADMIN_API_KEY is empty — /api/admin/* and ingest protection are unavailable (401). Set ADMIN_API_KEY.");
  if (!STAKING_ADDRESS) console.warn("STAKING_ADDRESS not set — /api/chain-events/ingest-tx disabled.");
});
