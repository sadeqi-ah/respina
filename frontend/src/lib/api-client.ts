import { ApiError } from "./api-error";

type Options = { method?: string; body?: unknown; signal?: AbortSignal };

/**
 * Browser → BFF (`/api/backend/<path>`). Throws ApiError for any non-2xx response. A 401 means the
 * session is over (the proxy already tried a refresh), so the user goes back to the login page.
 */
export async function apiFetch<T>(path: string, { method = "GET", body, signal }: Options = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/backend/${path.replace(/^\/+|\/+$/g, "")}`, {
      method,
      signal,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "fetch",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw ApiError.network(error);
  }

  if (response.status === 401 && typeof window !== "undefined") {
    const next = window.location.pathname + window.location.search;
    // A full reload on purpose: it drops every cached query of the ended session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!response.ok) throw await ApiError.fromResponse(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
