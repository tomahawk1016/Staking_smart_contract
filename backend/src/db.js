import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

export function openDatabase(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      address TEXT PRIMARY KEY COLLATE NOCASE,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      is_online INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS staking_events (
      id TEXT PRIMARY KEY,
      tx_hash TEXT NOT NULL COLLATE NOCASE,
      log_index INTEGER NOT NULL,
      block_number INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      user_address TEXT NOT NULL COLLATE NOCASE,
      position_index TEXT,
      plan_id TEXT,
      amount TEXT,
      principal TEXT,
      reward_paid TEXT,
      early INTEGER,
      penalty_rewards TEXT,
      block_timestamp INTEGER,
      source TEXT NOT NULL DEFAULT 'rpc'
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_staking_events_tx_log
      ON staking_events(tx_hash, log_index);
  `);
  return db;
}
