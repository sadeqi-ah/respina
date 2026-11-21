"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { listCustomers } from "./api";
import { parseListParams, toQueryString, type ListParams } from "./params";

export const customerKeys = {
  all: ["customers"] as const,
  list: (params: ListParams) => ["customers", "list", params] as const,
};

export function useCustomers(params: ListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: ({ signal }) => listCustomers(params, signal),
    placeholderData: keepPreviousData, // keep the old page on screen while the next one loads
  });
}

/** List params from the URL, plus a setter that replaces the URL (no history entry per keystroke). */
export function useListParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useMemo(() => parseListParams(new URLSearchParams(searchParams)), [searchParams]);

  const setParams = useCallback(
    (patch: Partial<ListParams>) => {
      // Any change other than the page itself goes back to page 1.
      const next = { ...params, ...patch, page: patch.page ?? 1 };
      router.replace(`${pathname}${toQueryString(next)}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return [params, setParams] as const;
}
