/** Base URL including `/api` prefix, e.g. `http://localhost:3001/api` */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:3001/api";
}
