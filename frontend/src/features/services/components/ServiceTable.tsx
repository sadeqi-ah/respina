"use client";

import { Ellipsis, History, Pause, Play } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import {
  DashboardButton,
  DashboardMenu,
  DashboardMenuContent,
  DashboardMenuItem,
  DashboardMenuTrigger,
} from "@/components/block/dashboard-shell";
import { cn } from "@/lib/utils";
import type { Service } from "@/types/api";

import { ServiceStatusBadge } from "./ServiceStatusBadge";

// Same Obsidian table as the customers list. Columns hide as the container narrows:
// created → type. Name, status and actions are always shown.
const cell = "px-3 py-2.5 text-start align-middle @lg/table:px-4";
const hideBelow = { sm: "hidden @sm/table:table-cell", lg: "hidden @lg/table:table-cell" } as const;

type Props = {
  services: Service[];
  canChangeStatus: boolean;
  // `opener` is the selected menu item, so the dialog can give focus back to its menu on close.
  onChangeStatus: (service: Service, opener: Element) => void;
  onShowHistory: (service: Service, opener: Element) => void;
};

export function ServiceTable({ services, canChangeStatus, onChangeStatus, onShowHistory }: Props) {
  const t = useTranslations("services");
  const format = useFormatter();

  return (
    <table className="w-full border-collapse text-start text-sm">
      <caption className="sr-only">{t("tableCaption")}</caption>
      {/* Each header cell is pinned to the top of the shell's scroll area and draws its own top and
          bottom rules as inset shadows. Collapsed borders belong to the table, not the row: they
          scroll away with it and Chromium leaves a 1px hole above a stuck header where they were. */}
      <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-(--obsidian-dashboard-shell-background) [&_th]:shadow-[inset_0_1px_0_var(--obsidian-dashboard-shell-border),inset_0_-1px_0_var(--obsidian-dashboard-shell-border)]">
        <tr className="text-xs text-(--obsidian-dashboard-shell-text-subtle)">
          <th scope="col" className={cn(cell, "font-normal")}>
            {t("columns.name")}
          </th>
          <th scope="col" className={cn(cell, hideBelow.sm, "font-normal")}>
            {t("columns.type")}
          </th>
          <th scope="col" className={cn(cell, "font-normal")}>
            {t("columns.status")}
          </th>
          <th scope="col" className={cn(cell, hideBelow.lg, "font-normal")}>
            {t("columns.created")}
          </th>
          <th scope="col" className="w-10 py-2.5 ps-0 pe-3 @lg/table:pe-4">
            <span className="sr-only">{t("columns.actions")}</span>
          </th>
        </tr>
      </thead>
      {/* Anything scrolled into view (keyboard focus, find-in-page) stops below the pinned header. */}
      <tbody className="[&_*]:scroll-mt-12">
        {services.map((service) => (
          <tr
            key={service.id}
            className="border-b border-(--obsidian-dashboard-shell-border) transition-colors duration-200 last:border-b-0 hover:bg-(--obsidian-dashboard-shell-hover) motion-reduce:transition-none"
          >
            <td className={cell}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium">{service.name}</span>
                {/* The type moves under the name once its own column is hidden. */}
                <span className="truncate text-xs text-(--obsidian-dashboard-shell-text-subtle) @sm/table:hidden">
                  {t(`types.${service.service_type}`)}
                </span>
              </div>
            </td>
            <td className={cn(cell, hideBelow.sm, "text-(--obsidian-dashboard-shell-text-muted)")}>
              {t(`types.${service.service_type}`)}
            </td>
            <td className={cell}>
              <ServiceStatusBadge status={service.status} />
            </td>
            <td
              className={cn(
                cell,
                hideBelow.lg,
                "text-xs whitespace-nowrap text-(--obsidian-dashboard-shell-text-muted)",
              )}
            >
              <time dateTime={service.created_at}>
                {format.dateTime(new Date(service.created_at), { dateStyle: "medium" })}
              </time>
            </td>
            <td className="w-10 py-2.5 ps-0 pe-3 text-end align-middle @lg/table:pe-4">
              <DashboardMenu>
                <DashboardMenuTrigger asChild>
                  <DashboardButton
                    variant="ghost"
                    size="icon"
                    aria-label={t("actionsFor", { name: service.name })}
                    className="size-7"
                  >
                    <Ellipsis aria-hidden />
                  </DashboardButton>
                </DashboardMenuTrigger>
                <DashboardMenuContent align="end" className="min-w-44">
                  {canChangeStatus && (
                    <DashboardMenuItem onSelect={(event) => onChangeStatus(service, event.target as Element)}>
                      {service.status === "active" ? <Pause aria-hidden /> : <Play aria-hidden />}
                      {t(service.status === "active" ? "suspend" : "activate")}
                    </DashboardMenuItem>
                  )}
                  <DashboardMenuItem onSelect={(event) => onShowHistory(service, event.target as Element)}>
                    <History aria-hidden />
                    {t("viewHistory")}
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
