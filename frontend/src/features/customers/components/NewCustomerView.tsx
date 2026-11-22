"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { dashboardButtonVariants } from "@/components/block/dashboard-shell";
import { EmptyState } from "@/components/states/EmptyState";
import { PendingSkeleton, SkeletonLine } from "@/components/states/PendingSkeleton";
import { useMe } from "@/features/auth/queries";
import { useShellConfig } from "@/features/shell/shell-config";

import { CustomerForm } from "./CustomerForm";

export function NewCustomerView() {
  const t = useTranslations("customers");
  const te = useTranslations("errors");
  const { data: me, isPending } = useMe();

  let body;
  if (isPending)
    body = (
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

  useShellConfig({ title: t("new") });

  return <div className="@container/page flex min-h-full flex-col">{body}</div>;
}
