import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState() {
  const t = useTranslations("common");
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 p-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-4 w-full max-w-sm" />
    </div>
  );
}
