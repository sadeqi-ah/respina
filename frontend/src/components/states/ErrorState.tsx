"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardButton } from "@/components/block/dashboard-shell";
import { ApiError } from "@/lib/api-error";
import { translateError } from "@/lib/translate-error";

/** A failed load, with the translated reason, the request ID for support, and a retry. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("common");
  const te = useTranslations("errors");
  const apiError = error instanceof ApiError ? error : ApiError.network(error);

  return (
    <div
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-3 border-t border-(--obsidian-dashboard-shell-border) px-6 py-16 text-center"
    >
      <AlertCircle aria-hidden className="size-6 text-destructive" />
      <p className="text-sm font-medium">{translateError(te, apiError)}</p>
      {apiError.requestId && (
        <p className="text-xs text-(--obsidian-dashboard-shell-text-subtle)">
          {t("requestId")}:{" "}
          <bdi dir="ltr" className="font-mono">
            {apiError.requestId}
          </bdi>
        </p>
      )}
      <DashboardButton variant="secondary" size="sm" onClick={onRetry}>
        {t("retry")}
      </DashboardButton>
    </div>
  );
}
