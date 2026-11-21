"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { ApiError } from "@/lib/api-error";

import { createCustomer, getCustomer, listCustomers } from "./api";
import { parseListParams, toQueryString, type ListParams } from "./params";
import type { CustomerValues } from "./schemas";

export const customerKeys = {
  all: ["customers"] as const,
  lists: ["customers", "list"] as const,
  list: (params: ListParams) => ["customers", "list", params] as const,
  detail: (id: number) => ["customers", "detail", id] as const,
};

export function useCustomer(id: number) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: ({ signal }) => getCustomer(id, signal),
    // A 404/403 won't change on retry; show not-found or the error right away.
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
}

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

/** POST /customers. On success every cached list is stale (new row, new counts) and the detail is seeded. */
export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CustomerValues) => createCustomer(values),
    onSuccess: async (customer) => {
      queryClient.setQueryData(customerKeys.detail(customer.id), customer);
      await queryClient.invalidateQueries({ queryKey: customerKeys.lists });
    },
  });
}
