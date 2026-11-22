import { describe, expect, it, vi } from "vitest";

import { sendWithRefresh } from "./refresh";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ok = () => json(200, { ok: true });
const expired = () => json(401, { error: { code: "token_invalid", message: "expired" } });
const fresh = { access: "new-access", refresh: "new-refresh" };

describe("sendWithRefresh (refresh at most once)", () => {
  it("passes a successful response through without refreshing", async () => {
    const send = vi.fn().mockResolvedValue(ok());
    const refreshTokens = vi.fn();
    const out = await sendWithRefresh({ access: "a", refresh: "r", send, refreshTokens });
    expect(out.response.status).toBe(200);
    expect(out.tokens).toBeUndefined();
    expect(out.signedOut).toBeFalsy();
    expect(refreshTokens).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith("a");
  });

  it("on 401 token_invalid: refreshes once, retries with the new token, returns new tokens", async () => {
    const send = vi.fn().mockResolvedValueOnce(expired()).mockResolvedValueOnce(ok());
    const refreshTokens = vi.fn().mockResolvedValue(fresh);
    const out = await sendWithRefresh({ access: "old", refresh: "r", send, refreshTokens });
    expect(refreshTokens).toHaveBeenCalledExactlyOnceWith("r");
    expect(send).toHaveBeenNthCalledWith(2, "new-access");
    expect(out.response.status).toBe(200);
    expect(out.tokens).toEqual(fresh);
  });

  it("access cookie already gone (expired) but refresh present: refreshes before the first send", async () => {
    const send = vi.fn().mockResolvedValue(ok());
    const refreshTokens = vi.fn().mockResolvedValue(fresh);
    const out = await sendWithRefresh({ access: undefined, refresh: "r", send, refreshTokens });
    expect(send).toHaveBeenCalledExactlyOnceWith("new-access");
    expect(out.tokens).toEqual(fresh);
  });

  it("refresh rejected: signed out, returns the 401", async () => {
    const send = vi.fn().mockResolvedValue(expired());
    const refreshTokens = vi.fn().mockResolvedValue(null);
    const out = await sendWithRefresh({ access: "old", refresh: "bad", send, refreshTokens });
    expect(out.response.status).toBe(401);
    expect(out.signedOut).toBe(true);
    expect(out.tokens).toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never loops: a second 401 after refreshing is returned as-is and signs out", async () => {
    const send = vi.fn().mockResolvedValue(expired());
    const refreshTokens = vi.fn().mockResolvedValue(fresh);
    const out = await sendWithRefresh({ access: "old", refresh: "r", send, refreshTokens });
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(out.response.status).toBe(401);
    expect(out.signedOut).toBe(true);
  });

  it.each([
    ["403", json(403, { error: { code: "permission_denied" } })],
    ["404", json(404, { error: { code: "not_found" } })],
    ["401 not_authenticated", json(401, { error: { code: "not_authenticated" } })],
    ["401 without a JSON body", new Response("nope", { status: 401 })],
  ])("does not refresh for %s", async (_name, response) => {
    const send = vi.fn().mockResolvedValue(response);
    const refreshTokens = vi.fn();
    const out = await sendWithRefresh({ access: "a", refresh: "r", send, refreshTokens });
    expect(refreshTokens).not.toHaveBeenCalled();
    expect(out.response.status).toBe(response.status);
  });

  it("401 token_invalid with no refresh cookie: signed out, no refresh attempt", async () => {
    const send = vi.fn().mockResolvedValue(expired());
    const refreshTokens = vi.fn();
    const out = await sendWithRefresh({ access: "old", refresh: undefined, send, refreshTokens });
    expect(refreshTokens).not.toHaveBeenCalled();
    expect(out.signedOut).toBe(true);
  });

  it("returns a body that can still be read after the token check", async () => {
    const send = vi.fn().mockResolvedValue(json(404, { error: { code: "not_found", message: "x" } }));
    const out = await sendWithRefresh({ access: "a", refresh: "r", send, refreshTokens: vi.fn() });
    await expect(out.response.json()).resolves.toMatchObject({ error: { code: "not_found" } });
  });
});
