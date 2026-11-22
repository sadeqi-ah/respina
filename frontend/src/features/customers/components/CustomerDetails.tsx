import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { PendingSkeleton, SkeletonLine } from "@/components/states/PendingSkeleton";
import type { Customer } from "@/types/api";

/** The Details tab: a plain description list. */
export function CustomerDetails({ customer }: { customer: Customer }) {
  const t = useTranslations("customers.details");
  const format = useFormatter();
  const rows: { label: string; value: ReactNode }[] = [
    { label: t("firstName"), value: customer.first_name },
    { label: t("lastName"), value: customer.last_name },
    { label: t("email"), value: <bdi dir="ltr">{customer.email}</bdi> },
    {
      label: t("phone"),
      value: (
        <bdi dir="ltr" className="tabular-nums">
          {customer.phone}
        </bdi>
      ),
    },
    { label: t("services"), value: format.number(customer.services_count) },
    {
      label: t("created"),
      value: (
        <time dateTime={customer.created_at}>
          {format.dateTime(new Date(customer.created_at), { dateStyle: "long", timeStyle: "short" })}
        </time>
      ),
    },
  ];
  return <DetailsList rows={rows} />;
}

const DETAIL_FIELDS = ["firstName", "lastName", "email", "phone", "services", "created"] as const;

/** The Details tab while the customer loads: the real labels, a placeholder line for each value. */
export function CustomerDetailsSkeleton() {
  const t = useTranslations("customers.details");
  return (
    <PendingSkeleton kind="customer-details">
      <DetailsList
        rows={DETAIL_FIELDS.map((field, i) => ({
          label: t(field),
          value: <SkeletonLine className={i % 2 ? "w-32" : "w-44"} />,
        }))}
      />
    </PendingSkeleton>
  );
}

function DetailsList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="@container/details grid border-t border-(--obsidian-dashboard-shell-border) text-sm">
      {rows.map(({ label, value }) => (
        <div
          key={label}
          className="grid gap-1 border-b border-(--obsidian-dashboard-shell-border) px-4 py-3 @md/details:grid-cols-[12rem_1fr] @lg/details:px-6"
        >
          <dt className="text-(--obsidian-dashboard-shell-text-subtle)">{label}</dt>
          <dd className="min-w-0 truncate">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
