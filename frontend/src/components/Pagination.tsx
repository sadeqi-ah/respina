"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { DashboardButton } from "@/components/block/dashboard-shell";

type Props = { page: number; totalPages: number; count: number; onPageChange: (page: number) => void };

/** Previous / next with "page X of Y". Chevrons mirror in RTL (they point along the reading direction). */
export function Pagination({ page, totalPages, count, onPageChange }: Props) {
  const t = useTranslations("common");
  const format = useFormatter();
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={t("pagination")}
      className="flex items-center justify-between gap-3 border-t border-(--obsidian-dashboard-shell-border) px-4 py-3 text-xs text-(--obsidian-dashboard-shell-text-muted)"
    >
      <span>{t("results", { count: format.number(count) })}</span>
      <div className="flex items-center gap-2">
        <DashboardButton
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("previousPage")}
        >
          <ChevronLeft aria-hidden className="rtl:-scale-x-100" />
        </DashboardButton>
        <span aria-live="polite" className="tabular-nums">
          {t("pageOf", { page: format.number(page), total: format.number(totalPages) })}
        </span>
        <DashboardButton
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("nextPage")}
        >
          <ChevronRight aria-hidden className="rtl:-scale-x-100" />
        </DashboardButton>
      </div>
    </nav>
  );
}
