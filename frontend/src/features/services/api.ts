import { apiFetch } from "@/lib/api-client";
import type { Page, Service, ServiceStatus, StatusLog } from "@/types/api";

import { SERVICES_PAGE_SIZE, type ServiceFilters } from "./params";
import type { ServiceValues } from "./schemas";

export function listServices(customerId: number, filters: ServiceFilters, signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(filters.page), page_size: String(SERVICES_PAGE_SIZE) });
  if (filters.status) query.set("status", filters.status);
  if (filters.type) query.set("service_type", filters.type);
  return apiFetch<Page<Service>>(`customers/${customerId}/services?${query}`, { signal });
}

export function createService(customerId: number, values: ServiceValues) {
  return apiFetch<Service>(`customers/${customerId}/services`, { method: "POST", body: values });
}

export function changeServiceStatus(serviceId: number, status: ServiceStatus, reason: string) {
  return apiFetch<Service>(`services/${serviceId}/status`, { method: "POST", body: { status, reason } });
}

export function listStatusHistory(serviceId: number, signal?: AbortSignal) {
  // An audit trail is short; one page of 100 (the API maximum) covers it.
  return apiFetch<Page<StatusLog>>(`services/${serviceId}/status-history?page_size=100`, { signal });
}
