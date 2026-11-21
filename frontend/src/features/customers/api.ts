import { apiFetch } from "@/lib/api-client";
import type { Customer, Page } from "@/types/api";

import { PAGE_SIZE, type ListParams } from "./params";
import type { CustomerValues } from "./schemas";

export function listCustomers(params: ListParams, signal?: AbortSignal): Promise<Page<Customer>> {
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(PAGE_SIZE),
    ordering: params.ordering,
  });
  if (params.search) query.set("search", params.search);
  return apiFetch<Page<Customer>>(`customers?${query}`, { signal });
}

export function createCustomer(values: CustomerValues): Promise<Customer> {
  return apiFetch<Customer>("customers", { method: "POST", body: values });
}

export function getCustomer(id: number, signal?: AbortSignal): Promise<Customer> {
  return apiFetch<Customer>(`customers/${id}`, { signal });
}
