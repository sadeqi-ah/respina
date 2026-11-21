import { apiFetch } from "@/lib/api-client";
import type { Customer, Page } from "@/types/api";

import { PAGE_SIZE, type ListParams } from "./params";

export function listCustomers(params: ListParams, signal?: AbortSignal): Promise<Page<Customer>> {
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(PAGE_SIZE),
    ordering: params.ordering,
  });
  if (params.search) query.set("search", params.search);
  return apiFetch<Page<Customer>>(`customers?${query}`, { signal });
}
