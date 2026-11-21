import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder rows while the first page loads. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  const t = useTranslations("common");
  return (
    <div role="status" aria-live="polite" className="border-t border-(--obsidian-dashboard-shell-border)">
      <span className="sr-only">{t("loading")}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-(--obsidian-dashboard-shell-border) px-4 py-3"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="hidden h-4 w-48 @sm/table:block" />
          <Skeleton className="ms-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
