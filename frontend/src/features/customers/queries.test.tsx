import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { api, server } from "@/test/server";
import type { Customer, Page } from "@/types/api";

import { DEFAULT_PARAMS } from "./params";
import { cachedCustomer, customerKeys, useCustomer } from "./queries";

const customer = (id: number, full_name: string): Customer => ({
  id,
  first_name: full_name.split(" ")[0],
  last_name: full_name.split(" ")[1],
  full_name,
  email: `c${id}@example.com`,
  phone: "+989120000000",
  services_count: 2,
  created_at: "2026-11-01T00:00:00Z",
});
const page = (results: Customer[]): Page<Customer> => ({
  count: results.length,
  page: 1,
  page_size: 20,
  total_pages: 1,
  results,
});

function setup(listAgeMs: number | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  if (listAgeMs !== null)
    queryClient.setQueryData(customerKeys.list(DEFAULT_PARAMS), page([customer(3, "Sara Ahmadi")]), {
      updatedAt: Date.now() - listAgeMs,
    });
  let requests = 0;
  server.use(
    http.get(api("customers/3"), () => {
      requests += 1;
      return HttpResponse.json(customer(3, "Sara Rahimi")); // the server's newer version
    }),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper, requests: () => requests };
}

describe("useCustomer, opened from the list", () => {
  it("renders the list's row at once and doesn't refetch a fresh one", async () => {
    const { wrapper, requests } = setup(1_000);
    const { result } = renderHook(() => useCustomer(3), { wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.data?.full_name).toBe("Sara Ahmadi");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests()).toBe(0);
  });

  it("refetches a stale row in the background, keeping it on screen meanwhile", async () => {
    const { wrapper, requests } = setup(60_000);
    const { result } = renderHook(() => useCustomer(3), { wrapper });

    expect(result.current.data?.full_name).toBe("Sara Ahmadi");
    await waitFor(() => expect(result.current.data?.full_name).toBe("Sara Rahimi"));
    expect(requests()).toBe(1);
  });

  it("loads normally when no list has the customer", async () => {
    const { wrapper } = setup(null);
    const { result } = renderHook(() => useCustomer(3), { wrapper });

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.data?.full_name).toBe("Sara Rahimi"));
  });

  it("finds the customer for the shell's title, preferring their own entry", () => {
    const { queryClient } = setup(1_000);
    expect(cachedCustomer(queryClient, 3)?.full_name).toBe("Sara Ahmadi");
    queryClient.setQueryData(customerKeys.detail(3), customer(3, "Sara Rahimi"));
    expect(cachedCustomer(queryClient, 3)?.full_name).toBe("Sara Rahimi");
    expect(cachedCustomer(queryClient, 4)).toBeUndefined();
  });
});
