import { describe, expect, it } from "vitest";

import { ApiError } from "./api-error";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

describe("ApiError.fromResponse", () => {
  it("reads the shared envelope", async () => {
    const error = await ApiError.fromResponse(
      json(400, {
        error: {
          code: "validation_error",
          message: "Invalid input.",
          details: { email: [{ code: "unique", message: "Taken." }] },
          request_id: "req-1",
        },
      }),
    );
    expect(error).toMatchObject({
      status: 400,
      code: "validation_error",
      message: "Invalid input.",
      details: { email: [{ code: "unique", message: "Taken." }] },
      requestId: "req-1",
    });
  });

  it("falls back to internal_error for a 5xx without a JSON body", async () => {
    const error = await ApiError.fromResponse(
      new Response("<html>Bad Gateway</html>", { status: 502, statusText: "Bad Gateway" }),
    );
    expect(error).toMatchObject({ status: 502, code: "internal_error", message: "Bad Gateway", details: {} });
  });

  it("falls back to unknown_error for a 4xx without an envelope", async () => {
    const error = await ApiError.fromResponse(json(418, { detail: "teapot" }));
    expect(error.code).toBe("unknown_error");
  });

  it("drops details that are not {field: [{code, message}]}", async () => {
    const error = await ApiError.fromResponse(
      json(400, { error: { code: "validation_error", message: "x", details: { email: "Taken." } } }),
    );
    expect(error.details).toEqual({});
  });

  it("takes the request id from the header when the body has none", async () => {
    const error = await ApiError.fromResponse(
      json(500, { error: { code: "internal_error", message: "x" } }, { "X-Request-ID": "hdr-9" }),
    );
    expect(error.requestId).toBe("hdr-9");
  });
});

describe("ApiError.network", () => {
  it("is status 0 with network_error", () => {
    expect(ApiError.network(new TypeError("Failed to fetch"))).toMatchObject({
      status: 0,
      code: "network_error",
      message: "Failed to fetch",
    });
  });
});
