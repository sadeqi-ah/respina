import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useServices } from "@/features/services/queries";
import { api, server } from "@/test/server";
import type { Customer, Page, Service } from "@/types/api";

import { PREFETCH_DELAY_MS, usePrefetchCustomer } from "./prefetch";
import { useCustomer } from "./queries";

const customer: Customer = {
  id: 3,
  first_name: "Sara",
  last_name: "Ahmadi",
  full_name: "Sara Ahmadi",
  email: "sara@example.com",
  phone: "+989120000000",
  services_count: 0,
  created_at: "2026-11-01T00:00:00Z",
};
const noServices: Page<Service> = { count: 0, page: 1, page_size: 20, total_pages: 0, results: [] };

describe("usePrefetchCustomer", () => {
  let requests: string[];
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
    requests = [];
    server.use(
      http.get(api("customers/3"), ({ request }) => {
        requests.push(new URL(request.url).pathname);
        return HttpResponse.json(customer);
      }),
      http.get(api("customers/3/services"), ({ request }) => {
        requests.push(new URL(request.url).pathname);
        return HttpResponse.json(noServices);
      }),
    );
  });
  afterEach(() => vi.useRealTimers());

  it("fetches nothing for a pointer that only passes over the row", () => {
    const { result } = renderHook(() => usePrefetchCustomer(), { wrapper });
    const row = result.current(3);
    act(() => {
      row.onPointerEnter();
      vi.advanceTimersByTime(PREFETCH_DELAY_MS - 50);
      row.onPointerLeave();
      vi.advanceTimersByTime(PREFETCH_DELAY_MS);
    });
    expect(requests).toEqual([]);
  });

  it("fetches the page's data when focus rests on the row, under the keys the page reads", async () => {
    const { result } = renderHook(() => usePrefetchCustomer(), { wrapper });
    act(() => {
      result.current(3).onFocus();
      vi.advanceTimersByTime(PREFETCH_DELAY_MS);
    });
    await vi.waitFor(() => expect(requests).toHaveLength(2));

    // The detail page's own hooks, with its URL state (tab included), find both entries ready.
    const urlState = { tab: "services", status: null, type: null, page: 1 } as const;
    const page = renderHook(
      () => ({
        customer: useCustomer(3),
        services: useServices(3, urlState),
      }),
      { wrapper },
    );
    expect(page.result.current.customer.isPending).toBe(false);
    expect(page.result.current.services.isPending).toBe(false);
    expect(requests).toHaveLength(2); // nothing fetched twice
  });
});
