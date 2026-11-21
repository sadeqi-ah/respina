import { describe, expect, it, vi } from "vitest";

import { createSharedRefresh } from "./shared-refresh";

const pair = (n: number) => ({ access: `a${n}`, refresh: `r${n}` });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createSharedRefresh", () => {
  it("concurrent callers with the same token share one refresh and get the same pair", async () => {
    let resolve!: (v: ReturnType<typeof pair>) => void;
    const refresh = vi.fn(() => new Promise<ReturnType<typeof pair>>((r) => (resolve = r)));
    const shared = createSharedRefresh(refresh);

    const first = shared("old", "req-1");
    const second = shared("old", "req-2");
    resolve(pair(1));

    expect(await first).toEqual(pair(1));
    expect(await second).toEqual(pair(1));
    expect(refresh).toHaveBeenCalledExactlyOnceWith("old", "req-1");
  });

  it("reuses a settled result during the grace period, then refreshes again", async () => {
    let clock = 0;
    const refresh = vi.fn().mockResolvedValueOnce(pair(1)).mockResolvedValueOnce(pair(2));
    const shared = createSharedRefresh(refresh, { graceMs: 10_000, now: () => clock });

    expect(await shared("old", null)).toEqual(pair(1));
    await flush();
    clock = 9_999;
    expect(await shared("old", null)).toEqual(pair(1)); // late request with the old cookie
    clock = 10_001;
    expect(await shared("old", null)).toEqual(pair(2));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("keeps a rejection (null) for the grace period too", async () => {
    const refresh = vi.fn().mockResolvedValue(null);
    const shared = createSharedRefresh(refresh);
    expect(await shared("bad", null)).toBeNull();
    await flush();
    expect(await shared("bad", null)).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not keep thrown errors (Django unreachable): the next call retries", async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(pair(1));
    const shared = createSharedRefresh(refresh);
    await expect(shared("old", null)).rejects.toThrow("down");
    await flush();
    expect(await shared("old", null)).toEqual(pair(1));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("different refresh tokens never share a result", async () => {
    const refresh = vi.fn(async (token: string) => ({ access: `a-${token}`, refresh: `r-${token}` }));
    const shared = createSharedRefresh(refresh);
    const [x, y] = await Promise.all([shared("t1", null), shared("t2", null)]);
    expect(x?.access).toBe("a-t1");
    expect(y?.access).toBe("a-t2");
  });

  it("caps the number of tracked tokens", async () => {
    const refresh = vi.fn(async (token: string) => ({ access: token, refresh: token }));
    const shared = createSharedRefresh(refresh, { maxEntries: 2 });
    await shared("t1", null);
    await shared("t2", null);
    await shared("t3", null); // evicts t1
    await flush();
    await shared("t1", null);
    expect(refresh).toHaveBeenCalledTimes(4);
  });
});
