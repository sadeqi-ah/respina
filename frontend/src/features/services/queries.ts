"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { customerKeys } from "@/features/customers/queries";
import { ApiError } from "@/lib/api-error";
import { translateError } from "@/lib/translate-error";
import type { Page, Service, ServiceStatus } from "@/types/api";

import { changeServiceStatus, createService, listServices, listStatusHistory } from "./api";
import type { ServiceFilters } from "./params";
import type { ServiceValues } from "./schemas";

export const serviceKeys = {
  all: ["services"] as const,
  /** Every cached list (any filter, any page) of one customer's services. */
  lists: (customerId: number) => ["services", "list", customerId] as const,
  list: (customerId: number, filters: ServiceFilters) => ["services", "list", customerId, filters] as const,
  history: (serviceId: number) => ["services", "history", serviceId] as const,
};

export function useServices(customerId: number, { status, type, page }: ServiceFilters) {
  // Exactly the filter fields: callers pass the page's whole URL state (with its tab), which must not
  // end up in the key, or a prefetch of the same list would miss it.
  const filters: ServiceFilters = { status, type, page };
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

export function useCreateService(customerId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ServiceValues) => createService(customerId, values),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: serviceKeys.lists(customerId) }),
        // services_count changed: the header pill and the customers table.
        queryClient.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
        queryClient.invalidateQueries({ queryKey: customerKeys.lists }),
      ]),
  });
}

export type StatusChange = { service: Service; status: ServiceStatus; reason: string };

/** What onMutate hands to onError: every list it touched, as it was before. */
export type StatusSnapshot = { previous: [QueryKey, Page<Service> | undefined][] };

/**
 * Optimistically applies a status change to the cached service lists of `change.service`'s
 * customer and returns the snapshot onError needs to undo it.
 *
 * Lists are cached per filter, e.g. ["services","list",8,{status:null,…}] and
 * ["services","list",8,{status:"active",…}], and the service can be on any of them.
 */
export async function applyOptimisticStatus(
  queryClient: QueryClient,
  change: StatusChange,
): Promise<StatusSnapshot> {
  const queryKey = serviceKeys.lists(change.service.customer_id);

  // An in-flight fetch could land after our write and put the old status back.
  await queryClient.cancelQueries({ queryKey });

  // One entry per cached filter/page. These are the original objects; we only ever replace them,
  // never edit them, so the snapshot stays intact for the rollback.
  const previous = queryClient.getQueriesData<Page<Service>>({ queryKey });

  for (const [key, page] of previous) {
    if (!page?.results.some((s) => s.id === change.service.id)) continue;
    queryClient.setQueryData<Page<Service>>(key, {
      ...page,
      results: page.results.map((s) => (s.id === change.service.id ? { ...s, status: change.status } : s)),
    });
  }

  // Filtered lists keep the row (now with its new badge) until onSettled refetches. Dropping it
  // would make the row vanish under the click and leave `count` stale until the refetch anyway.
  return { previous };
}

export function useChangeServiceStatus() {
  const queryClient = useQueryClient();
  const t = useTranslations("services.statusChange");
  const te = useTranslations("errors");
  return useMutation({
    mutationFn: ({ service, status, reason }: StatusChange) =>
      changeServiceStatus(service.id, status, reason),
    onMutate: (change) => applyOptimisticStatus(queryClient, change),
    // Hook-level callbacks run even if the component that called mutate() has unmounted.
    onSuccess: (_data, { service, status }) =>
      toast.success(t(status === "suspended" ? "suspended" : "activated", { name: service.name })),
    onError: (error, { service }, snapshot) => {
      // Put back exactly what was there, then say why.
      for (const [key, data] of snapshot?.previous ?? []) queryClient.setQueryData(key, data);
      const apiError = error instanceof ApiError ? error : ApiError.network(error);
      toast.error(t("failed", { name: service.name }), { description: translateError(te, apiError) });
    },
    onSettled: (_data, _error, { service }) =>
      Promise.all([
        // Server truth wins either way: status, updated_at, and membership in filtered lists.
        queryClient.invalidateQueries({ queryKey: serviceKeys.lists(service.customer_id) }),
        queryClient.invalidateQueries({ queryKey: serviceKeys.history(service.id) }),
      ]),
  });
}
