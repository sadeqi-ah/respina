import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Page, Service } from "@/types/api";

import type { ServiceFilters } from "./params";
import { applyOptimisticStatus, serviceKeys } from "./queries";

const service = (id: number, customer_id: number, status: Service["status"] = "active"): Service => ({
  id,
  customer_id,
  name: `svc-${id}`,
  service_type: "vps",
  service_type_display: "VPS",
  status,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
});
const page = (results: Service[]): Page<Service> => ({
  count: results.length,
  page: 1,
  page_size: 20,
  total_pages: 1,
  results,
});
const filters = (status: ServiceFilters["status"] = null, p = 1): ServiceFilters => ({
  status,
  type: null,
  page: p,
});

let qc: QueryClient;
const target = service(1, 8);

beforeEach(() => {
  qc = new QueryClient();
  qc.setQueryData(serviceKeys.list(8, filters()), page([target, service(2, 8)]));
  qc.setQueryData(serviceKeys.list(8, filters("active")), page([target, service(2, 8)]));
  qc.setQueryData(serviceKeys.list(8, filters("suspended")), page([service(3, 8, "suspended")]));
  qc.setQueryData(serviceKeys.list(9, filters()), page([service(4, 9)]));
});

const rowsOf = (customerId: number, f: ServiceFilters) =>
  qc.getQueryData<Page<Service>>(serviceKeys.list(customerId, f))!.results;

describe("applyOptimisticStatus", () => {
  it("cancels in-flight fetches of this customer's lists first", async () => {
    const cancel = vi.spyOn(qc, "cancelQueries");
    await applyOptimisticStatus(qc, { service: target, status: "suspended", reason: "" });
    expect(cancel).toHaveBeenCalledWith(expect.objectContaining({ queryKey: serviceKeys.lists(8) }));
  });

  it("writes the new status into the unfiltered list, leaving other rows alone", async () => {
    await applyOptimisticStatus(qc, { service: target, status: "suspended", reason: "" });
    expect(rowsOf(8, filters()).map((s) => [s.id, s.status])).toEqual([
      [1, "suspended"],
      [2, "active"],
    ]);
  });

  it("never shows the old status under a filter the service no longer matches", async () => {
    await applyOptimisticStatus(qc, { service: target, status: "suspended", reason: "" });
    // Either answer is fine here: drop the row, or show it with its new status until the refetch.
    const row = rowsOf(8, filters("active")).find((s) => s.id === 1);
    expect(row === undefined || row.status === "suspended").toBe(true);
  });

  it("does not touch other customers' lists or mutate cached objects", async () => {
    const before = rowsOf(8, filters());
    await applyOptimisticStatus(qc, { service: target, status: "suspended", reason: "" });
    expect(rowsOf(9, filters())[0].status).toBe("active");
    expect(before[0].status).toBe("active"); // the old snapshot object is still intact
  });

  it("returns a snapshot that restores every list exactly", async () => {
    const original = qc.getQueriesData({ queryKey: serviceKeys.lists(8) });
    const snapshot = await applyOptimisticStatus(qc, { service: target, status: "suspended", reason: "" });
    for (const [key, data] of snapshot.previous) qc.setQueryData(key, data);
    expect(qc.getQueriesData({ queryKey: serviceKeys.lists(8) })).toEqual(original);
  });
});
