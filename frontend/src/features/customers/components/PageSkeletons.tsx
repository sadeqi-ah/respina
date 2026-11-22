"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";

import { PendingSkeleton, SkeletonLine } from "@/components/states/PendingSkeleton";
import { serviceSkeletonRows, ServiceTableSkeleton } from "@/features/services/components/ServiceTable";
import { parseDetailParams, type Tab } from "@/features/services/params";

import { DEFAULT_PARAMS, parseListParams, type ListParams } from "../params";
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

/** The list's loading.tsx: the skeleton with the URL's sort shown in the header. */
export function CustomersRouteSkeleton() {
  const searchParams = useSearchParams();
  return <CustomersPageSkeleton params={parseListParams(new URLSearchParams(searchParams))} />;
}

/** A customer page's loading.tsx: the skeleton of the tab in the URL. */
export function CustomerRouteSkeleton() {
  const searchParams = useSearchParams();
  return <CustomerPageSkeleton tab={parseDetailParams(new URLSearchParams(searchParams)).tab} />;
}

/** The new-customer form while it loads: its labels and fields, inside the page's padding. */
export function NewCustomerSkeleton() {
  return (
    <PendingSkeleton
      kind="customer-form"
      className="border-t border-(--obsidian-dashboard-shell-border) px-4 py-6 @lg/page:px-6"
    >
      <div className="grid w-full max-w-xl gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-3">
            <SkeletonLine className="w-20" />
            <span data-slot="skeleton" className="block h-9 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </PendingSkeleton>
  );
}

/** /customers/new's loading.tsx. */
export function NewCustomerRouteSkeleton() {
  return (
    <div className="@container/page flex min-h-full flex-col">
      <NewCustomerSkeleton />
    </div>
  );
}
