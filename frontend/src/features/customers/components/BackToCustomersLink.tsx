"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { dashboardButtonVariants } from "@/components/block/dashboard-shell";
import { useMe } from "@/features/auth/queries";

import { listReturnPath, RETURN_PARAM } from "../params";

/**
 * Back to the customers list view the detail page was opened from (?from=), or the plain list.
 * A real link rather than history.back(), so it also works when the page was opened directly.
 */
export function BackToCustomersLink() {
  const t = useTranslations();
  const { data: me } = useMe();
  const searchParams = useSearchParams();

  // Customers have no list to go back to: their own record is their "My account" page.
  if (me?.role !== "staff") return null;

  return (
    <Link
      href={listReturnPath(searchParams.get(RETURN_PARAM))}
      // The name keeps the visible text ("Customers") in it, for voice control (WCAG 2.5.3).
      aria-label={t("customers.backToList")}
      className={dashboardButtonVariants({ variant: "ghost", size: "sm" })}
    >
      <ArrowLeft aria-hidden className="rtl:-scale-x-100" />
      {/* Phones keep the arrow only, so the customer's name still fits beside it. */}
      <span className="hidden @md/dashboard-shell:inline">{t("nav.customers")}</span>
    </Link>
  );
}
