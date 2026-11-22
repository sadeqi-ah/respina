"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { dashboardButtonVariants } from "@/components/block/dashboard-shell";
import { EmptyState } from "@/components/states/EmptyState";
import { useShellConfig } from "@/features/shell/shell-config";

export default function CustomerNotFound() {
  const t = useTranslations("customers");
  useShellConfig({ title: t("title") });
  return (
    <div className="flex min-h-full flex-col">
      <EmptyState
        title={t("notFound.title")}
        detail={t("notFound.detail")}
        action={
          <Link href="/customers" className={dashboardButtonVariants({ variant: "secondary", size: "sm" })}>
            {t("form.back")}
          </Link>
        }
      />
    </div>
  );
}
