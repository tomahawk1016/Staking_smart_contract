const TOKEN_KEY = "stakemaster_backend_token";

export function getStoredBackendToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredBackendToken(token: string | null): void {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isJwtLikelyExpired(token: string): boolean {
  const p = decodeJwtPayload(token);
  const exp = typeof p?.exp === "number" ? p.exp : null;
  if (!exp) return false;
  return exp * 1000 < Date.now() + 5000;
}
