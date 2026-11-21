import type { Tokens } from "./tokens";

export type RefreshOutcome = {
  /** The response to return to the browser (Django's, or the original 401). */
  response: Response;
  /** New tokens to store in cookies, when a refresh happened and worked. */
  tokens?: Tokens;
  /** True when the session is over: the caller clears both cookies. */
  signedOut?: boolean;
};

type Options = {
  access: string | undefined;
  refresh: string | undefined;
  /** Sends the proxied request to Django with this access token (or none). */
  send: (access: string | undefined) => Promise<Response>;
  /** Exchanges a refresh token for a new pair; null if Django rejects it. */
  refreshTokens: (refresh: string) => Promise<Tokens | null>;
};

/** True when Django says the access token itself is bad or expired (code `token_invalid`). */
export async function isTokenInvalid(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { error?: { code?: unknown } } | null;
  return body?.error?.code === "token_invalid";
}

/**
 * Sends a request to Django, refreshing the access token AT MOST ONCE (plan §6 BFF):
 * a Django 401 `token_invalid` triggers one refresh and one retry; if the refresh fails the
 * session is over. It must never loop, and never refresh for other errors (403, 404, 400…).
 */
export async function sendWithRefresh({
  access,
  refresh,
  send,
  refreshTokens,
}: Options): Promise<RefreshOutcome> {
  let refreshed: Tokens | undefined;
  let attempted = false; // the single "already refreshed" flag: covers both pre-send and retry

  // Runs the one allowed refresh. Django rotates refresh tokens, so success must be stored.
  const tryRefresh = async (): Promise<boolean> => {
    attempted = true;
    const tokens = refresh ? await refreshTokens(refresh) : null;
    if (tokens) refreshed = tokens;
    return tokens !== null;
  };

  let token = access;
  if (!access && refresh) {
    // Access cookie expired away but a refresh token exists: refresh before the first send.
    if (await tryRefresh()) token = refreshed?.access;
    else {
      // Refresh rejected: still ask Django so the browser gets its real 401 envelope.
      return { response: await send(undefined), signedOut: true };
    }
  }

  let response = await send(token);
  if (!(await isTokenInvalid(response))) {
    return { response, tokens: refreshed };
  }

  // 401 token_invalid: refresh at most once, retry at most once, never loop.
  if (attempted || !(await tryRefresh())) {
    return { response, signedOut: true };
  }
  response = await send(refreshed?.access);
  if (await isTokenInvalid(response)) {
    return { response, signedOut: true };
  }
  // Return the rotated tokens even if the retry ended in 404/409: the old refresh token is gone.
  return { response, tokens: refreshed };
}
