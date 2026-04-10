import { formatUnits } from "viem";

export function formatToken(amount: bigint | undefined, decimals: number, digits = 4) {
  if (amount === undefined) return "—";
  const s = formatUnits(amount, decimals);
  const [i, f = ""] = s.split(".");
  if (digits <= 0) return i;
  return `${i}${f ? "." : ""}${f.slice(0, digits)}`.replace(/\.$/, "");
}

export function shortAddr(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function clampInt(v: string, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

