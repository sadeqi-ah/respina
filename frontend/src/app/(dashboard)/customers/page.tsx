"use client";

import { useTranslations } from "next-intl";

import { AppShell } from "@/features/shell/AppShell";

// Placeholder: the customer list arrives in Task 2.4.
export default function CustomersPage() {
  const t = useTranslations();
  return (
    <AppShell title={t("nav.customers")}>
      <p className="p-6 text-muted-foreground">{t("common.comingSoon")}</p>
    </AppShell>
  );
}
