export type Tokens = { access: string; refresh: string };

/**
 * Seconds until a JWT's `exp`, read WITHOUT verifying the signature. Only used to size the cookie
 * lifetime; Django verifies every token on every request.
 */
export function secondsUntilExpiry(jwt: string, now = Date.now()): number | null {
  const payload = jwt.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/"))) as { exp?: unknown };
    return typeof json.exp === "number" ? Math.max(0, Math.floor(json.exp - now / 1000)) : null;
  } catch {
    return null;
  }
}
