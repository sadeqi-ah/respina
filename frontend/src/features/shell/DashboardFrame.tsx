"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { useMe } from "@/features/auth/queries";
import { BackToCustomersLink } from "@/features/customers/components/BackToCustomersLink";
import { cachedCustomer } from "@/features/customers/queries";
import { parseDetailParams, TABS } from "@/features/services/params";

import { ShellFrame, type ShellConfig } from "./shell-config";

const DETAIL_PATH = /^\/customers\/([1-9][0-9]{0,9})$/;

/** Same size as a toolbar control, so the toolbar row has its final height before the page mounts. */
function ControlPlaceholder({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block h-8 rounded-md bg-(--obsidian-dashboard-shell-control) shadow-(--obsidian-dashboard-shell-control-shadow) pointer-coarse:h-11 ${className}`}
    />
  );
}

/**
 * The dashboard layout's shell. Its fallback config is what each route's page will show, as far as
 * it is known without the page: the title (a customer's name when it is already cached), the
 * detail tabs, and placeholders the size of the toolbar controls.
 */
export function DashboardFrame({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  // "/" only redirects: show the shell of where it is going.
  let path = pathname;
  if (path === "/" && me)
    path = me.role === "customer" && me.customer_id ? `/customers/${me.customer_id}` : "/customers";

  let fallback: ShellConfig = { title: "" };
  const detail = DETAIL_PATH.exec(path);
  if (path === "/customers") {
    fallback = { title: t("customers.title"), filters: <ControlPlaceholder className="w-72 max-w-full" /> };
  } else if (path === "/customers/new") {
    fallback = { title: t("customers.new") };
  } else if (detail) {
    const customer = cachedCustomer(queryClient, Number(detail[1]));
    const { tab } = parseDetailParams(new URLSearchParams(searchParams));
    fallback = {
      title: customer?.full_name ?? t("customers.title"),
      headerLeading: <BackToCustomersLink />,
      status: customer ? t("services.count", { count: customer.services_count }) : undefined,
      statusTone: "neutral",
      tabs: TABS.map((value) => ({ value, label: t(`customers.tabs.${value}`) })),
      tab,
      filters:
        tab === "services" ? (
          <>
            <ControlPlaceholder className="w-28" />
            <ControlPlaceholder className="w-24" />
          </>
        ) : undefined,
    };
  }

  return <ShellFrame fallback={fallback}>{children}</ShellFrame>;
}
