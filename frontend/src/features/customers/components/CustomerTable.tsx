"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Copy, Ellipsis, Eye } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { toast } from "sonner";

import {
  DashboardButton,
  DashboardMenu,
  DashboardMenuContent,
  DashboardMenuItem,
  DashboardMenuTrigger,
} from "@/components/block/dashboard-shell";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types/api";

import { sortStateOf, type Ordering, type SortKey } from "../params";

// Adapted from Obsidian's dashboard-shell-page table (registry: @obsidian/dashboard-shell-page). Columns hide as the table's own container
// narrows, in this order: created → services → phone → email. The name is always shown.
const cell = "px-3 py-2.5 text-start align-middle @lg/table:px-4";
// Thresholds are measured, not guessed: each is the first container size where the columns
// shown so far fit without overflow (e2e/table-fit.spec.ts sweeps every width to keep it so).
const hideBelow = {
  email: "hidden @md/table:table-cell", // name + email + actions need ~410px
  phone: "hidden @xl/table:table-cell", // + phone ~540px
  services: "hidden @2xl/table:table-cell", // + services ~645px
  created: "hidden @3xl/table:table-cell", // + created ~755px
} as const;

type Props = { customers: Customer[]; ordering: Ordering; onSort: (key: SortKey) => void };

export function CustomerTable({ customers, ordering, onSort }: Props) {
  const t = useTranslations("customers");
  const format = useFormatter();
  const sort = sortStateOf(ordering);

  const copyEmail = async (customer: Customer) => {
    try {
      await navigator.clipboard.writeText(customer.email);
      toast.success(t("emailCopied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <table className="w-full border-collapse text-start text-sm">
      <caption className="sr-only">{t("tableCaption")}</caption>
      {/* Each header cell is pinned to the top of the shell's scroll area and draws its own top and
          bottom rules as inset shadows. Collapsed borders belong to the table, not the row: they
          scroll away with it and Chromium leaves a 1px hole above a stuck header where they were. */}
      <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-(--obsidian-dashboard-shell-background) [&_th]:shadow-[inset_0_1px_0_var(--obsidian-dashboard-shell-border),inset_0_-1px_0_var(--obsidian-dashboard-shell-border)]">
        <tr className="text-xs text-(--obsidian-dashboard-shell-text-subtle)">
          <SortHeader label={t("columns.name")} sortKey="name" sort={sort} onSort={onSort} />
          <th scope="col" className={cn(cell, hideBelow.email, "font-normal")}>
            {t("columns.email")}
          </th>
          <th scope="col" className={cn(cell, hideBelow.phone, "font-normal")}>
            {t("columns.phone")}
          </th>
          <th scope="col" className={cn(cell, hideBelow.services, "text-end font-normal")}>
            {t("columns.services")}
          </th>
          <SortHeader
            label={t("columns.created")}
            sortKey="created"
            sort={sort}
            onSort={onSort}
            className={hideBelow.created}
          />
          <th scope="col" className="w-10 py-2.5 ps-0 pe-3 @lg/table:pe-4">
            <span className="sr-only">{t("columns.actions")}</span>
          </th>
        </tr>
      </thead>
      {/* Anything scrolled into view (keyboard focus, find-in-page) stops below the pinned header. */}
      <tbody className="[&_*]:scroll-mt-12">
        {customers.map((customer) => (
          <tr
            key={customer.id}
            className="border-b border-(--obsidian-dashboard-shell-border) transition-colors duration-200 last:border-b-0 hover:bg-(--obsidian-dashboard-shell-hover) motion-reduce:transition-none"
          >
            <td className={cell}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link
                  href={`/customers/${customer.id}`}
                  className="touch-target relative max-w-full font-medium outline-none hover:underline focus-visible:underline"
                >
                  {/* Truncate inside: overflow-hidden on the link would clip its touch-target hit area. */}
                  <span className="block truncate">{customer.full_name}</span>
                </Link>
                {/* The email moves under the name once its own column is hidden. */}
                <bdi
                  dir="ltr"
                  className="max-w-full self-start truncate text-xs text-(--obsidian-dashboard-shell-text-subtle) @md/table:hidden"
                >
                  {customer.email}
                </bdi>
              </div>
            </td>
            <td
              className={cn(
                cell,
                hideBelow.email,
                "max-w-64 truncate text-(--obsidian-dashboard-shell-text-muted)",
              )}
            >
              <bdi dir="ltr">{customer.email}</bdi>
            </td>
            <td
              className={cn(
                cell,
                hideBelow.phone,
                "whitespace-nowrap text-(--obsidian-dashboard-shell-text-muted)",
              )}
            >
              <bdi dir="ltr" className="tabular-nums">
                {customer.phone}
              </bdi>
            </td>
            <td className={cn(cell, hideBelow.services, "text-end tabular-nums")}>
              {format.number(customer.services_count)}
            </td>
            <td
              className={cn(
                cell,
                hideBelow.created,
                "text-xs whitespace-nowrap text-(--obsidian-dashboard-shell-text-muted)",
              )}
            >
              <time dateTime={customer.created_at}>
                {format.dateTime(new Date(customer.created_at), { dateStyle: "medium" })}
              </time>
            </td>
            <td className="w-10 py-2.5 ps-0 pe-3 text-end align-middle @lg/table:pe-4">
              <DashboardMenu>
                <DashboardMenuTrigger asChild>
                  <DashboardButton
                    variant="ghost"
                    size="icon"
                    aria-label={t("actionsFor", { name: customer.full_name })}
                    className="size-7"
                  >
                    <Ellipsis aria-hidden />
                  </DashboardButton>
                </DashboardMenuTrigger>
                <DashboardMenuContent align="end" className="min-w-44">
                  <DashboardMenuItem asChild>
                    <Link href={`/customers/${customer.id}`}>
                      <Eye aria-hidden />
                      {t("view")}
                    </Link>
                  </DashboardMenuItem>
                  <DashboardMenuItem onSelect={() => copyEmail(customer)}>
                    <Copy aria-hidden />
                    {t("copyEmail")}
                  </DashboardMenuItem>
                </DashboardMenuContent>
              </DashboardMenu>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = sort.key === sortKey;
  const Icon = !isActive ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={isActive ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
      className={cn(cell, "font-normal", className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "touch-target relative -mx-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 transition-colors duration-150 outline-none hover:bg-(--obsidian-dashboard-shell-muted) hover:text-(--obsidian-dashboard-shell-foreground) focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring)",
          isActive && "text-(--obsidian-dashboard-shell-foreground)",
        )}
      >
        {label}
        <Icon aria-hidden className={cn("size-3", !isActive && "opacity-60")} />
      </button>
    </th>
  );
}
