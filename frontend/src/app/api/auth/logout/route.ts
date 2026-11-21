import { NextResponse, type NextRequest } from "next/server";

import { requestIdFrom } from "@/lib/bff/request-id";
import { clearAuthCookies } from "@/lib/server/cookies";
import { envelope } from "@/lib/server/errors";

/** Clears both token cookies. (Django has no refresh blacklist yet; tokens expire on their own.) */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = requestIdFrom(request.headers.get("x-request-id"));
  if (request.headers.get("x-requested-with") !== "fetch") {
    return envelope(403, "csrf_failed", "Missing X-Requested-With header.", requestId);
  }
  const response = new NextResponse(null, { status: 204, headers: { "X-Request-ID": requestId } });
  clearAuthCookies(response);
  return response;
}
