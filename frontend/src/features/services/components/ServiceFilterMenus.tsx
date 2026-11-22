"use client";

import { useTranslations } from "next-intl";

import { DashboardFilterMenu } from "@/components/block/dashboard-shell";
import { SERVICE_STATUSES, SERVICE_TYPES } from "@/types/api";

import type { ServiceFilters } from "../params";

const ALL = "all";

/** Toolbar filters for the services tab. "all" in the menu is `null` in the URL state. */
export function ServiceFilterMenus({
  filters,
  onChange,
}: {
  filters: ServiceFilters;
  onChange: (patch: Partial<ServiceFilters>) => void;
}) {
  const t = useTranslations("services");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DashboardFilterMenu
        label={t("filters.status")}
        value={filters.status ?? ALL}
        options={[
          { value: ALL, label: t("filters.all") },
          ...SERVICE_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
        ]}
        onValueChange={(v) => onChange({ status: v === ALL ? null : (v as ServiceFilters["status"]) })}
      />
      <DashboardFilterMenu
        label={t("filters.type")}
        value={filters.type ?? ALL}
        options={[
          { value: ALL, label: t("filters.all") },
          ...SERVICE_TYPES.map((s) => ({ value: s, label: t(`types.${s}`) })),
        ]}
        onValueChange={(v) => onChange({ type: v === ALL ? null : (v as ServiceFilters["type"]) })}
      />
    </div>
  );
}
