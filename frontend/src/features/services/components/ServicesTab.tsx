"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { DashboardButton } from "@/components/block/dashboard-shell";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { TableSkeleton } from "@/components/states/TableSkeleton";
import type { Service } from "@/types/api";

import type { ServiceFilters } from "../params";
import { useServices } from "../queries";
import { ServiceTable } from "./ServiceTable";
import { StatusHistorySheet } from "./StatusHistorySheet";

type Props = {
  customerId: number;
  filters: ServiceFilters;
  onFiltersChange: (patch: Partial<ServiceFilters>) => void;
  addAction: React.ReactNode;
};

export function ServicesTab({ customerId, filters, onFiltersChange, addAction }: Props) {
  const t = useTranslations("services");
  const query = useServices(customerId, filters);
  const [historyOf, setHistoryOf] = useState<Service | null>(null);
  const filtered = filters.status !== null || filters.type !== null;

  let body;
  if (query.isPending) body = <TableSkeleton />;
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
          canChangeStatus={false}
          onChangeStatus={() => undefined}
          onShowHistory={setHistoryOf}
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
      <StatusHistorySheet service={historyOf} onOpenChange={(open) => !open && setHistoryOf(null)} />
    </>
  );
}
