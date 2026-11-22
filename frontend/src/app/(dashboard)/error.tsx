"use client";

import { ErrorState } from "@/components/states/ErrorState";
import { ApiError } from "@/lib/api-error";

/**
 * A dashboard page that failed to render. It replaces only the page: the shell (from the layout
 * above this boundary) stays, with the route's title. Retry fetches and renders the page again.
 */
export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  const shown = error instanceof ApiError ? error : new ApiError(0, "unknown_error", "Something went wrong.");
  return (
    <div className="flex min-h-full flex-col">
      <ErrorState error={shown} onRetry={retry} />
    </div>
  );
}
