"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { Me } from "@/types/api";

export const meQueryKey = ["auth", "me"] as const;

export const meQuery = queryOptions({
  queryKey: meQueryKey,
  queryFn: ({ signal }) => apiFetch<Me>("auth/me", { signal }),
});

export function useMe() {
  return useQuery(meQuery);
}
