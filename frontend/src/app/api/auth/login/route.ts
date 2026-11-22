import { NextResponse, type NextRequest } from "next/server";

import { setAuthCookies } from "@/lib/server/cookies";
import { asTokens, djangoFetch, DjangoUnavailable } from "@/lib/server/django";
import { envelope } from "@/lib/server/errors";
import { withRequestLog } from "@/lib/server/request-log";

/** Exchanges email + password for tokens at Django and stores them in httpOnly cookies. */
export const POST = withRequestLog(
  async (request: NextRequest, _ctx: unknown, requestId: string): Promise<NextResponse> => {
    if (request.headers.get("x-requested-with") !== "fetch") {
      return envelope(403, "csrf_failed", "Missing X-Requested-With header.", requestId);
    }

    let upstream: Response;
    try {
      upstream = await djangoFetch("/api/v1/auth/token/", {
        method: "POST",
        requestId,
        headers: { "Content-Type": "application/json" },
        body: await request.text(),
      });
    } catch (error) {
      if (error instanceof DjangoUnavailable) {
        return envelope(503, "dependency_unavailable", "The API is unavailable.", requestId);
      }
      throw error;
    }

    const body = await upstream.json().catch(() => null);
    const tokens = upstream.ok ? asTokens(body) : null;
    if (!tokens) {
      // Django's envelope (invalid_credentials, validation_error, throttled…) goes to the form as-is.
      return NextResponse.json(
        body ?? { error: { code: "internal_error", message: "Unexpected response." } },
        {
          status: upstream.ok ? 502 : upstream.status,
          headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" },
        },
      );
    }

    const response = new NextResponse(null, { status: 204, headers: { "X-Request-ID": requestId } });
    setAuthCookies(response, tokens);
    return response;
  },
);
