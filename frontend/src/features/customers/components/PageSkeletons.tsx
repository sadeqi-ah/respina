"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { serviceSkeletonRows, ServiceTableSkeleton } from "@/features/services/components/ServiceTable";
import type { Tab } from "@/features/services/params";

import { DEFAULT_PARAMS, type ListParams } from "../params";
import { cachedCustomer } from "../queries";
import { CustomerDetailsSkeleton } from "./CustomerDetails";
import { CustomerTableSkeleton } from "./CustomerTable";

/** The customers page before its view mounts (loading.tsx, Suspense): the list's table, loading. */
export function CustomersPageSkeleton({ params = DEFAULT_PARAMS }: { params?: ListParams }) {
  return (
    <div className="@container/table flex min-h-full flex-col">
      <CustomerTableSkeleton params={params} />
    </div>
  );
}

/**
 * A customer's page before its view mounts. The shell already shows the title and tabs; this is
 * the tab's content: as many service rows as the customer has, when that is cached.
 */
export function CustomerPageSkeleton({ tab = "services", id }: { tab?: Tab; id?: number }) {
  const params = useParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const customer = cachedCustomer(queryClient, id ?? Number(params.id));
  return (
    <div className="@container/table flex min-h-full flex-col">
      {tab === "details" ? (
        <CustomerDetailsSkeleton />
      ) : (
        <ServiceTableSkeleton rows={serviceSkeletonRows(customer?.services_count)} />
      )}
    </div>
  );
}
