// @vitest-environment node
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { server } from "@/test/server";

import { GET } from "./route";

vi.mock("server-only", () => ({}));

const DJANGO = "http://django.test";

function call(headers: Record<string, string> = {}) {
  const request = new NextRequest("http://bff.test/api/backend/customers?search=secret", {
    headers: { cookie: "access_token=jwt-access-value", ...headers },
  });
  return GET(request, { params: Promise.resolve({ path: ["customers"] }) });
}

describe("BFF proxy request id and request log", () => {
  let seen: string | null;
  let log: MockInstance<typeof console.log>;

  beforeEach(() => {
    vi.stubEnv("DJANGO_API_URL", DJANGO);
    seen = null;
    server.use(
      http.get(`${DJANGO}/api/v1/customers/`, ({ request }) => {
        seen = request.headers.get("x-request-id");
        return HttpResponse.json({ results: [] }, { headers: { "X-Request-ID": seen ?? "" } });
      }),
    );
    log = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    log.mockRestore();
  });

  function requestLines() {
    return log.mock.calls
      .map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
      .filter((line) => line.message === "request");
  }

  it("forwards a valid incoming X-Request-ID to Django and returns it", async () => {
    const response = await call({ "x-request-id": "caller-id-123" });

    expect(response.status).toBe(200);
    expect(seen).toBe("caller-id-123");
    expect(response.headers.get("x-request-id")).toBe("caller-id-123");
  });

  it.each<Record<string, string>>([{}, { "x-request-id": "bad id with spaces" }])(
    "creates an id when missing or invalid",
    async (headers) => {
      const response = await call(headers);

      expect(seen).toMatch(/^[0-9a-f]{32}$/);
      expect(response.headers.get("x-request-id")).toBe(seen);
    },
  );

  it("logs one request line with Django's fields and nothing sensitive", async () => {
    await call({ "x-request-id": "caller-id-123", authorization: "Bearer leaked" });

    const lines = requestLines();
    expect(lines).toHaveLength(1);
    const [line] = lines;
    expect(Object.keys(line).sort()).toEqual(
      ["duration_ms", "level", "logger", "message", "method", "path", "request_id", "status", "time"].sort(),
    );
    expect(line).toMatchObject({
      level: "INFO",
      logger: "bff.request",
      method: "GET",
      path: "/api/backend/customers", // path only, never the query string
      status: 200,
      request_id: "caller-id-123",
    });
    expect(Number.isInteger(line.duration_ms)).toBe(true);
    expect(line.duration_ms).toBeGreaterThanOrEqual(0);
    const raw = String(log.mock.calls[0][0]);
    for (const secret of ["jwt-access-value", "leaked", "secret"]) expect(raw).not.toContain(secret);
  });
});
