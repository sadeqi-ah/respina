import type { Tokens } from "./tokens";

type Options = { graceMs?: number; maxEntries?: number; now?: () => number };
type Entry = { promise: Promise<Tokens | null>; expiresAt: number };

/**
 * One refresh per refresh token, shared by every request that presents it (ADR-012).
 *
 * Django blacklists a refresh token as soon as it's rotated, so if two requests from the same
 * browser hit an expired access token at once, only the first refresh may reach Django; the second
 * would be rejected and sign the user out. Concurrent callers therefore share the in-flight
 * promise, and the result stays available for a short grace period so a request that started
 * just after (still carrying the old cookie) gets the same new pair.
 *
 * - Settled results (new tokens, or null = rejected) are kept for `graceMs`.
 * - Thrown errors (Django unreachable) are not kept: the next request retries.
 * - At most `maxEntries` tokens are tracked; the oldest is dropped first.
 * Per process: correct for our single Next.js server; several replicas would need sticky
 * sessions or a shared store.
 */
export function createSharedRefresh<C>(
  refresh: (token: string, context: C) => Promise<Tokens | null>,
  { graceMs = 10_000, maxEntries = 1_000, now = Date.now }: Options = {},
): (token: string, context: C) => Promise<Tokens | null> {
  const entries = new Map<string, Entry>();

  return (token, context) => {
    const t = now();
    for (const [key, entry] of entries) if (entry.expiresAt <= t) entries.delete(key);

    const existing = entries.get(token);
    if (existing) return existing.promise;

    const entry: Entry = { promise: refresh(token, context), expiresAt: Number.POSITIVE_INFINITY };
    entries.set(token, entry);
    entry.promise.then(
      () => {
        entry.expiresAt = now() + graceMs;
      },
      () => {
        if (entries.get(token) === entry) entries.delete(token);
      },
    );
    if (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
    return entry.promise;
  };
}
