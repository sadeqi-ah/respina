import "server-only";

import { createSharedRefresh } from "@/lib/bff/shared-refresh";
import type { Tokens } from "@/lib/bff/tokens";

/** Internal Django URL (never exposed to the browser; no NEXT_PUBLIC_ prefix). */
export function djangoBase(): string {
  const url = process.env.DJANGO_API_URL;
  if (!url) throw new Error("DJANGO_API_URL is not set");
  return url.replace(/\/+$/, "");
}

const TIMEOUT_MS = 10_000;

export class DjangoUnavailable extends Error {}

/** fetch() to Django with a timeout. Network failures become DjangoUnavailable (→ 503). */
export async function djangoFetch(
  path: string,
  init: RequestInit & { requestId: string },
): Promise<Response> {
  const { requestId, headers, ...rest } = init;
  try {
    return await fetch(`${djangoBase()}${path}`, {
      ...rest,
      headers: { Accept: "application/json", ...headers, "X-Request-ID": requestId },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new DjangoUnavailable(error instanceof Error ? error.message : String(error));
  }
}

function asTokens(body: unknown): Tokens | null {
  const b = body as { access?: unknown; refresh?: unknown } | null;
  return typeof b?.access === "string" && typeof b.refresh === "string"
    ? { access: b.access, refresh: b.refresh }
    : null;
}

/** POST /auth/token/refresh/ (rotation on): a new pair, or null if the refresh token is rejected. */
export async function refreshTokens(refresh: string, requestId: string): Promise<Tokens | null> {
  const response = await djangoFetch("/api/v1/auth/token/refresh/", {
    method: "POST",
    requestId,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) return null;
  return asTokens(await response.json().catch(() => null));
}

/**
 * The refresh every route uses: concurrent requests presenting the same (soon blacklisted)
 * refresh token share one call to Django and get the same rotated pair (ADR-012).
 */
export const sharedRefreshTokens = createSharedRefresh(refreshTokens);

export { asTokens };
