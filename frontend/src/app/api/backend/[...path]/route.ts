import { NextResponse, type NextRequest } from "next/server";

import { toDjangoPath } from "@/lib/bff/path";
import { sendWithRefresh } from "@/lib/bff/refresh";
import { ACCESS_COOKIE, clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from "@/lib/server/cookies";
import { djangoFetch, DjangoUnavailable, sharedRefreshTokens } from "@/lib/server/django";
import { envelope } from "@/lib/server/errors";
import { logLine, withRequestLog } from "@/lib/server/request-log";

/**
 * BFF proxy: /api/backend/<path> → Django /api/v1/<path>/ with the access token from the
 * httpOnly cookie as a Bearer header. The browser never sees a token.
 */
async function proxy(
  request: NextRequest,
  ctx: RouteContext<"/api/backend/[...path]">,
  requestId: string,
): Promise<NextResponse> {
  const { path } = await ctx.params;
  const djangoPath = toDjangoPath(path);
  if (!djangoPath) return envelope(404, "not_found", "Not found.", requestId);

  // CSRF: cookies are SameSite=Lax, and every mutating call must carry a header that a cross-site
  // form can't send (a custom header forces a CORS preflight, which we never allow).
  const mutating = !["GET", "HEAD"].includes(request.method);
  if (mutating && request.headers.get("x-requested-with") !== "fetch") {
    return envelope(403, "csrf_failed", "Missing X-Requested-With header.", requestId);
  }

  const body = mutating ? await request.text() : undefined;
  const contentType = request.headers.get("content-type");
  const send = (access: string | undefined) =>
    djangoFetch(`${djangoPath}${request.nextUrl.search}`, {
      method: request.method,
      requestId,
      headers: {
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
        ...(contentType ? { "Content-Type": contentType } : {}),
      },
      body,
    });

  let outcome;
  try {
    outcome = await sendWithRefresh({
      access: request.cookies.get(ACCESS_COOKIE)?.value,
      refresh: request.cookies.get(REFRESH_COOKIE)?.value,
      send,
      refreshTokens: (refresh) => sharedRefreshTokens(refresh, requestId),
    });
  } catch (error) {
    if (error instanceof DjangoUnavailable) {
      logLine("ERROR", "bff.django", `django unavailable: ${error.message}`, requestId);
      return envelope(503, "dependency_unavailable", "The API is unavailable.", requestId);
    }
    throw error;
  }

  // Pass Django's status and body through; only safe headers, never Django's Set-Cookie.
  const upstream = outcome.response;
  const response = new NextResponse(upstream.status === 204 ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
      "X-Request-ID": upstream.headers.get("x-request-id") ?? requestId,
    },
  });
  if (outcome.tokens) setAuthCookies(response, outcome.tokens);
  if (outcome.signedOut) clearAuthCookies(response);
  return response;
}

const handler = withRequestLog(proxy);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
