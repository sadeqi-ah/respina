"use client";

import { AddCircle } from "@duo-icons/react";
import { useTranslations } from "next-intl";
import { notFound, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { DashboardButton } from "@/components/block/dashboard-shell";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { useMe } from "@/features/auth/queries";
import { AddServiceDialog } from "@/features/services/components/AddServiceDialog";
import { ServiceFilterMenus } from "@/features/services/components/ServiceFilterMenus";
import { ServicesTab } from "@/features/services/components/ServicesTab";
import {
  parseDetailParams,
  toDetailQuery,
  TABS,
  type DetailParams,
  type Tab,
} from "@/features/services/params";
import { AppShell } from "@/features/shell/AppShell";
import { ApiError } from "@/lib/api-error";

import { RETURN_PARAM } from "../params";
import { useCustomer } from "../queries";
import { BackToCustomersLink } from "./BackToCustomersLink";
import { CustomerDetails } from "./CustomerDetails";

function useDetailParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useMemo(() => parseDetailParams(new URLSearchParams(searchParams)), [searchParams]);
  // The list view this page was opened from; kept across tab and filter changes for the back link.
  const from = searchParams.get(RETURN_PARAM);
  const setParams = useCallback(
    (patch: Partial<DetailParams>) => {
      // A new filter or tab starts at page 1.
      const next = { ...params, ...patch, page: patch.page ?? 1 };
      const query = new URLSearchParams(toDetailQuery(next));
      if (from) query.set(RETURN_PARAM, from);
      const qs = query.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [from, params, pathname, router],
  );
  return [params, setParams] as const;
}

export function CustomerDetailView({ id }: { id: number }) {
  const t = useTranslations("customers");
  const ts = useTranslations("services");
  const { data: me } = useMe();
  const customer = useCustomer(id);
  const [params, setParams] = useDetailParams();
  const [adding, setAdding] = useState(false);
  const isStaff = me?.role === "staff"; // UX only: the API enforces it

  // Invisible and missing customers are both 404 from the API (scoping never leaks with a 403).
  if (customer.error instanceof ApiError && customer.error.status === 404) notFound();

  const addAction = isStaff ? (
    <DashboardButton variant="primary" size="sm" onClick={() => setAdding(true)}>
      <AddCircle aria-hidden />
      {ts("add.title")}
    </DashboardButton>
  ) : null;

  let body;
  if (customer.isPending) body = <LoadingState />;
  else if (customer.isError) body = <ErrorState error={customer.error} onRetry={() => customer.refetch()} />;
  else if (params.tab === "details") body = <CustomerDetails customer={customer.data} />;
  else
    body = (
      <ServicesTab
        customerId={id}
        filters={params}
        onFiltersChange={setParams}
        isStaff={isStaff}
        addAction={addAction}
      />
    );

  return (
    <AppShell
      title={customer.data?.full_name ?? t("title")}
      headerLeading={<BackToCustomersLink />}
      status={customer.data ? ts("count", { count: customer.data.services_count }) : undefined}
      statusTone="neutral"
      headerActions={addAction}
      tabs={TABS.map((tab) => ({ value: tab, label: t(`tabs.${tab}`) }))}
      tab={params.tab}
      onTabChange={(tab) => setParams({ tab: tab as Tab, status: null, type: null })}
      filters={
        params.tab === "services" && customer.data ? (
          <ServiceFilterMenus filters={params} onChange={setParams} />
        ) : undefined
      }
    >
      <div className="@container/table flex min-h-full flex-col">{body}</div>
      {isStaff && <AddServiceDialog customerId={id} open={adding} onOpenChange={setAdding} />}
    </AppShell>
  );
}
