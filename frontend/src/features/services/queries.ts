"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { listServices, listStatusHistory } from "./api";
import type { ServiceFilters } from "./params";

export const serviceKeys = {
  all: ["services"] as const,
  /** Every cached list (any filter, any page) of one customer's services. */
  lists: (customerId: number) => ["services", "list", customerId] as const,
  list: (customerId: number, filters: ServiceFilters) => ["services", "list", customerId, filters] as const,
  history: (serviceId: number) => ["services", "history", serviceId] as const,
};

export function useServices(customerId: number, filters: ServiceFilters) {
  return useQuery({
    queryKey: serviceKeys.list(customerId, filters),
    queryFn: ({ signal }) => listServices(customerId, filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useStatusHistory(serviceId: number | null) {
  return useQuery({
    queryKey: serviceKeys.history(serviceId ?? 0),
    queryFn: ({ signal }) => listStatusHistory(serviceId!, signal),
    enabled: serviceId !== null,
  });
}
