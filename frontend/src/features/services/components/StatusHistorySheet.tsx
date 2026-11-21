"use client";

import { ArrowRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { ErrorState } from "@/components/states/ErrorState";
import { useDirection } from "@/components/ui/direction";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMe } from "@/features/auth/queries";
import type { Service, StatusLog } from "@/types/api";

import { useStatusHistory } from "../queries";
import { ServiceStatusBadge } from "./ServiceStatusBadge";

type Props = { service: Service | null; onOpenChange: (open: boolean) => void };

/** The audit trail of one service, newest first: from → to, who, source, when, reason. */
export function StatusHistorySheet({ service, onOpenChange }: Props) {
  const t = useTranslations("services.history");
  const tc = useTranslations("common");
  const dir = useDirection();
  const history = useStatusHistory(service?.id ?? null);

  let body;
  if (!service) body = null;
  else if (history.isPending)
    body = (
      <div className="flex flex-col gap-3" role="status" aria-label={t("loading")}>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  else if (history.isError) body = <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  else if (history.data.results.length === 0)
    body = <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  else
    body = (
      <ol className="flex flex-col gap-3">
        {history.data.results.map((log) => (
          <HistoryRow key={log.id} log={log} />
        ))}
      </ol>
    );

  return (
    <Sheet open={service !== null} onOpenChange={onOpenChange}>
      {/* The sheet opens from the inline end: right in LTR, left in RTL. */}
      <SheetContent
        side={dir === "rtl" ? "left" : "right"}
        className="w-full gap-0 sm:max-w-md"
        closeLabel={tc("close")}
      >
        <SheetHeader className="border-b">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{service?.name}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">{body}</div>
      </SheetContent>
    </Sheet>
  );
}

function HistoryRow({ log }: { log: StatusLog }) {
  const t = useTranslations("services.history");
  const format = useFormatter();
  const { data: me } = useMe();

  const who =
    log.changed_by_id === null
      ? t("who.system")
      : log.changed_by_id === me?.id
        ? t("who.you")
        : t("who.user", { id: log.changed_by_id });

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <ServiceStatusBadge status={log.from_status} />
        <ArrowRight aria-label={t("to")} className="size-3.5 text-muted-foreground rtl:-scale-x-100" />
        <ServiceStatusBadge status={log.to_status} />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("byVia", { who, source: t(`source.${log.source}`) })} ·{" "}
        <time dateTime={log.created_at}>
          {format.dateTime(new Date(log.created_at), { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </p>
      {log.reason && <p className="text-sm whitespace-pre-wrap">{log.reason}</p>}
    </li>
  );
}
