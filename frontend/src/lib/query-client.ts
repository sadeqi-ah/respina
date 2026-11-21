import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./api-error";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retry network blips and 5xx once; never retry 4xx (they won't change on their own).
        retry: (failureCount, error) =>
          failureCount < 1 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
      },
      mutations: { retry: false },
    },
  });
}
