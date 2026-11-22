import "server-only";

import type { NextRequest } from "next/server";

import { requestIdFrom } from "@/lib/bff/request-id";

const LOGGER = "bff.request";

type Level = "INFO" | "WARNING" | "ERROR";

/**
 * One JSON object per line, with the same keys as Django's JSONFormatter (time, level, logger,
 * message, request_id, then the extra fields), so one request_id can be followed across both logs.
 */
export function logLine(
  level: Level,
  logger: string,
  message: string,
  requestId: string,
  extra: Record<string, string | number> = {},
): void {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    logger,
    message,
    request_id: requestId,
    ...extra,
  });
  if (level === "INFO") console.log(line);
  else console.error(line);
}

type Handler<C> = (request: NextRequest, ctx: C, requestId: string) => Promise<Response>;

/**
 * Wraps a route handler like Django's RequestIDMiddleware + RequestTimingMiddleware: picks the
 * request id (caller's if valid, else a new one), passes it to the handler, makes sure the response
 * carries it, and logs one "request" line with the path only (no query, headers, cookies or body).
 */
export function withRequestLog<C>(handler: Handler<C>): (request: NextRequest, ctx: C) => Promise<Response> {
  return async (request, ctx) => {
    const requestId = requestIdFrom(request.headers.get("x-request-id"));
    const start = performance.now();
    let status = 500; // if the handler throws, Next answers 500
    try {
      const response = await handler(request, ctx, requestId);
      status = response.status;
      if (!response.headers.has("x-request-id")) response.headers.set("X-Request-ID", requestId);
      return response;
    } finally {
      logLine("INFO", LOGGER, "request", requestId, {
        method: request.method,
        path: request.nextUrl.pathname,
        status,
        duration_ms: Math.trunc(performance.now() - start),
      });
    }
  };
}
