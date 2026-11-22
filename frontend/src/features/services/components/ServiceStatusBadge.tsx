import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ServiceStatus } from "@/types/api";

// Color and text together: the label carries the meaning, the color only reinforces it.
const tone: Record<ServiceStatus, string> = {
  active: "bg-success/10 text-success-text",
  suspended: "bg-warning/10 text-warning-text",
};

export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  const t = useTranslations("services.status");
  return (
    <Badge variant="secondary" className={cn("gap-1.5", tone[status])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {t(status)}
    </Badge>
  );
}
