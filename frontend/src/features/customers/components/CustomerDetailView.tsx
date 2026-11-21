"use client";

import { useTranslations } from "next-intl";
import { notFound, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
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

import { useCustomer } from "../queries";
import { CustomerDetails } from "./CustomerDetails";

function useDetailParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useMemo(() => parseDetailParams(new URLSearchParams(searchParams)), [searchParams]);
  const setParams = useCallback(
    (patch: Partial<DetailParams>) => {
      // A new filter or tab starts at page 1.
      const next = { ...params, ...patch, page: patch.page ?? 1 };
      router.replace(`${pathname}${toDetailQuery(next)}`, { scroll: false });
    },
    [params, pathname, router],
  );
  return [params, setParams] as const;
}

export function CustomerDetailView({ id }: { id: number }) {
  const t = useTranslations("customers");
  const ts = useTranslations("services");
  const customer = useCustomer(id);
  const [params, setParams] = useDetailParams();

  // Invisible and missing customers are both 404 from the API (scoping never leaks with a 403).
  if (customer.error instanceof ApiError && customer.error.status === 404) notFound();

  let body;
  if (customer.isPending) body = <LoadingState />;
  else if (customer.isError) body = <ErrorState error={customer.error} onRetry={() => customer.refetch()} />;
  else if (params.tab === "details") body = <CustomerDetails customer={customer.data} />;
  else body = <ServicesTab customerId={id} filters={params} onFiltersChange={setParams} addAction={null} />;

  return (
    <AppShell
      title={customer.data?.full_name ?? t("title")}
      status={customer.data ? ts("count", { count: customer.data.services_count }) : undefined}
      statusTone="neutral"
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
    </AppShell>
  );
}
