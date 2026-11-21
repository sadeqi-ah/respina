"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { Me } from "@/types/api";

export const meQueryKey = ["auth", "me"] as const;

export function useMe() {
  return useQuery({ queryKey: meQueryKey, queryFn: ({ signal }) => apiFetch<Me>("auth/me", { signal }) });
}
