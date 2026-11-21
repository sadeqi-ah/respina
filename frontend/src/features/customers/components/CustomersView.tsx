"use client";

import { AddCircle } from "@duo-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { DashboardButton, dashboardButtonVariants } from "@/components/block/dashboard-shell";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { TableSkeleton } from "@/components/states/TableSkeleton";
import { useMe } from "@/features/auth/queries";
import { AppShell } from "@/features/shell/AppShell";

import { nextOrdering } from "../params";
import { useCustomers, useListParams } from "../queries";
import { CustomerTable } from "./CustomerTable";
import { CustomerSearch } from "./CustomerToolbar";

export function CustomersView() {
  const t = useTranslations("customers");
  const { data: me } = useMe();
  const [params, setParams] = useListParams();
  const query = useCustomers(params);
  const isStaff = me?.role === "staff"; // UX only: the API enforces who may create

  const newCustomer = isStaff ? (
    <Link href="/customers/new" className={dashboardButtonVariants({ variant: "primary", size: "sm" })}>
      <AddCircle aria-hidden />
      {t("new")}
    </Link>
  ) : null;

  let body;
  if (query.isPending) body = <TableSkeleton />;
  else if (query.isError) body = <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  else if (query.data.count === 0 && params.search)
    body = (
      <EmptyState
        title={t("noResults.title")}
        detail={t("noResults.detail", { search: params.search })}
        action={
          <DashboardButton variant="secondary" size="sm" onClick={() => setParams({ search: "" })}>
            {t("clearSearch")}
          </DashboardButton>
        }
      />
    );
  else if (query.data.count === 0)
    body = <EmptyState title={t("empty.title")} detail={t("empty.detail")} action={newCustomer} />;
  else
    body = (
      <div aria-busy={query.isPlaceholderData} className={query.isPlaceholderData ? "opacity-60" : undefined}>
        <CustomerTable
          customers={query.data.results}
          ordering={params.ordering}
          onSort={(key) => setParams({ ordering: nextOrdering(params.ordering, key) })}
        />
        <Pagination
          page={query.data.page}
          totalPages={query.data.total_pages}
          count={query.data.count}
          onPageChange={(page) => setParams({ page })}
        />
      </div>
    );

  return (
    <AppShell
      title={t("title")}
      filters={<CustomerSearch value={params.search} onChange={(search) => setParams({ search })} />}
      toolbarActions={newCustomer}
    >
      <div className="@container/table flex min-h-full flex-col">{body}</div>
    </AppShell>
  );
}
