"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { dashboardButtonVariants } from "@/components/block/dashboard-shell";
import { EmptyState } from "@/components/states/EmptyState";
import { LoadingState } from "@/components/states/LoadingState";
import { useMe } from "@/features/auth/queries";
import { AppShell } from "@/features/shell/AppShell";

import { CustomerForm } from "./CustomerForm";

export function NewCustomerView() {
  const t = useTranslations("customers");
  const te = useTranslations("errors");
  const { data: me, isPending } = useMe();

  let body;
  if (isPending) body = <LoadingState />;
  // UX only: Django answers 403 for non-staff anyway, and the form would show that message.
  else if (me?.role !== "staff")
    body = (
      <EmptyState
        title={te("permission_denied")}
        detail={t("form.staffOnly")}
        action={
          <Link href="/customers" className={dashboardButtonVariants({ variant: "secondary", size: "sm" })}>
            {t("form.back")}
          </Link>
        }
      />
    );
  else
    body = (
      <div className="border-t border-(--obsidian-dashboard-shell-border) px-4 py-6 @lg/page:px-6">
        <CustomerForm />
      </div>
    );

  return (
    <AppShell title={t("new")}>
      <div className="@container/page flex min-h-full flex-col">{body}</div>
    </AppShell>
  );
}
