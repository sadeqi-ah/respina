import { NextResponse, type NextRequest } from "next/server";

import { clearAuthCookies } from "@/lib/server/cookies";
import { envelope } from "@/lib/server/errors";
import { withRequestLog } from "@/lib/server/request-log";

/** Clears both token cookies. (Django has no refresh blacklist yet; tokens expire on their own.) */
export const POST = withRequestLog(
  async (request: NextRequest, _ctx: unknown, requestId: string): Promise<NextResponse> => {
    if (request.headers.get("x-requested-with") !== "fetch") {
      return envelope(403, "csrf_failed", "Missing X-Requested-With header.", requestId);
    }
    const response = new NextResponse(null, { status: 204, headers: { "X-Request-ID": requestId } });
    clearAuthCookies(response);
    return response;
  },
);
