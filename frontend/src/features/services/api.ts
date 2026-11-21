import { apiFetch } from "@/lib/api-client";
import type { Page, Service, StatusLog } from "@/types/api";

import { SERVICES_PAGE_SIZE, type ServiceFilters } from "./params";

export function listServices(customerId: number, filters: ServiceFilters, signal?: AbortSignal) {
  const query = new URLSearchParams({
    page: String(filters.page),
    page_size: String(SERVICES_PAGE_SIZE),
  });
  if (filters.status) query.set("status", filters.status);
  if (filters.type) query.set("service_type", filters.type);
  return apiFetch<Page<Service>>(`customers/${customerId}/services?${query}`, {
    signal,
  });
}

export function listStatusHistory(serviceId: number, signal?: AbortSignal) {
  // An audit trail is short; one page of 100 (the API maximum) covers it.
  return apiFetch<Page<StatusLog>>(`services/${serviceId}/status-history?page_size=100`, { signal });
}
