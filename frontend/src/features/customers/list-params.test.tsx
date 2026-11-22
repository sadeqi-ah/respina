import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useListParams } from "./queries";

// No router in this hook: a list change must not cost a server round trip.
vi.mock("next/navigation", () => ({
  usePathname: () => "/customers",
  useSearchParams: () => new URLSearchParams("search=ali&page=3"),
  useRouter: () => {
    throw new Error("useListParams must not use the router");
  },
}));

describe("useListParams", () => {
  afterEach(() => vi.restoreAllMocks());

  it("replaces the URL in place, back to page 1 on a new search", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useListParams());
    expect(result.current[0]).toMatchObject({ search: "ali", page: 3 });

    act(() => result.current[1]({ search: "sara" }));
    expect(replaceState).toHaveBeenCalledWith(null, "", "/customers?search=sara");
    expect(window.location.search).toBe("?search=sara");
  });
});
