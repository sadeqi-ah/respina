"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { DashboardButton } from "@/components/block/dashboard-shell";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { useReturnFocus } from "@/hooks/use-return-focus";
import type { Service } from "@/types/api";

import type { ServiceFilters } from "../params";
import { useServices } from "../queries";
import { ServiceStatusToggle } from "./ServiceStatusToggle";
import { serviceSkeletonRows, ServiceTable, ServiceTableSkeleton } from "./ServiceTable";
import { StatusHistorySheet } from "./StatusHistorySheet";

type Props = {
  customerId: number;
  /** The customer's total, when known: the first unfiltered page's skeleton gets that many rows. */
  servicesCount?: number;
  /** While the customer itself still loads, a failed list waits: the customer may turn out a 404. */
  customerPending?: boolean;
  filters: ServiceFilters;
  onFiltersChange: (patch: Partial<ServiceFilters>) => void;
  isStaff: boolean;
  addAction: React.ReactNode;
};

export function ServicesTab({
  customerId,
  servicesCount,
  customerPending = false,
  filters,
  onFiltersChange,
  isStaff,
  addAction,
}: Props) {
  const t = useTranslations("services");
  const query = useServices(customerId, filters);
  const [toggling, setToggling] = useState<Service | null>(null);
  const toggleFocus = useReturnFocus();
  const historyFocus = useReturnFocus();
  const [historyOf, setHistoryOf] = useState<Service | null>(null);
  const filtered = filters.status !== null || filters.type !== null;
  const loading = query.isPending || (query.isError && customerPending);
  const rows = serviceSkeletonRows(filtered || filters.page > 1 ? undefined : servicesCount);

  let body;
  if (loading) body = <ServiceTableSkeleton rows={rows} />;
  else if (query.isError) body = <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  else if (query.data.count === 0 && filtered)
    body = (
      <EmptyState
        title={t("noResults.title")}
        detail={t("noResults.detail")}
        action={
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={() => onFiltersChange({ status: null, type: null })}
          >
            {t("clearFilters")}
          </DashboardButton>
        }
      />
    );
  else if (query.data.count === 0)
    body = <EmptyState title={t("empty.title")} detail={t("empty.detail")} action={addAction} />;
  else
    body = (
      <div aria-busy={query.isPlaceholderData} className={query.isPlaceholderData ? "opacity-60" : undefined}>
        <ServiceTable
          services={query.data.results}
          canChangeStatus={isStaff}
          onChangeStatus={(service, opener) => {
            toggleFocus.remember(opener);
            setToggling(service);
          }}
          onShowHistory={(service, opener) => {
            historyFocus.remember(opener);
            setHistoryOf(service);
          }}
        />
        <Pagination
          page={query.data.page}
          totalPages={query.data.total_pages}
          count={query.data.count}
          onPageChange={(page) => onFiltersChange({ page })}
        />
      </div>
    );

  return (
    <>
      {body}
      {isStaff && (
        <ServiceStatusToggle
          key={toggling?.id}
          service={toggling}
          onOpenChange={(open) => !open && setToggling(null)}
          onCloseAutoFocus={toggleFocus.onCloseAutoFocus}
        />
      )}
      <StatusHistorySheet
        service={historyOf}
        onOpenChange={(open) => !open && setHistoryOf(null)}
        onCloseAutoFocus={historyFocus.onCloseAutoFocus}
      />
    </>
  );
}
