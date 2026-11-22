import "server-only";

import { NextResponse } from "next/server";

/** The shared error envelope (plan §3.4) for errors the BFF itself produces. */
export function envelope(status: number, code: string, message: string, requestId: string): NextResponse {
  return NextResponse.json(
    { error: { code, message, request_id: requestId } },
    { status, headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" } },
  );
}
