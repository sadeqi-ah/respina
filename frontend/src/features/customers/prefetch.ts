"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { listServices } from "@/features/services/api";
import { serviceKeys } from "@/features/services/queries";

import { getCustomer } from "./api";
import { customerKeys } from "./queries";

/** How long the pointer or focus has to rest on a customer before their page is fetched. */
export const PREFETCH_DELAY_MS = 150;
const FIRST_SERVICES_PAGE = { status: null, type: null, page: 1 } as const;

/**
 * Fetches what a customer's page needs while the pointer rests on (or focus is on) their link, so
 * the page opens ready: the customer and the first page of their services, under the same keys the
 * page uses. A pointer that only passes over a row fetches nothing. Fresh entries (staleTime) are
 * not fetched again.
 */
export function usePrefetchCustomer() {
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cancel = useCallback(() => clearTimeout(timer.current), []);
  useEffect(() => cancel, [cancel]);

  const schedule = useCallback(
    (id: number) => {
      cancel();
      timer.current = setTimeout(() => {
        void queryClient.prefetchQuery({
          queryKey: customerKeys.detail(id),
          queryFn: ({ signal }) => getCustomer(id, signal),
        });
        void queryClient.prefetchQuery({
          queryKey: serviceKeys.list(id, FIRST_SERVICES_PAGE),
          queryFn: ({ signal }) => listServices(id, FIRST_SERVICES_PAGE, signal),
        });
      }, PREFETCH_DELAY_MS);
    },
    [cancel, queryClient],
  );

  return useCallback(
    (id: number) => ({
      onPointerEnter: () => schedule(id),
      onPointerLeave: cancel,
      onFocus: () => schedule(id),
      onBlur: cancel,
    }),
    [cancel, schedule],
  );
}
