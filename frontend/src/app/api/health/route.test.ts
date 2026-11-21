import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /api/health", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("answers 200 {status: ok}, uncached", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("stays healthy when Django is down: liveness must not depend on another service", async () => {
    vi.stubEnv("DJANGO_API_URL", "http://127.0.0.1:9"); // nothing listens on port 9
    const response = await GET();
    expect(response.status).toBe(200);
  });
});
