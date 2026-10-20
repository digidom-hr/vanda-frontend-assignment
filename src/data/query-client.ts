import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

export const MAX_RETRIES = 3;

/** Retry only what the server says is transient, a few times. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  return error instanceof ApiError ? error.retryable : false;
}

/** 1s, 2s, 4s... capped at 10s. A sleeping deployment can take a while to wake up. */
export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Series data changes rarely; avoid refetching on every focus or remount.
        staleTime: 5 * 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
        retryDelay,
      },
    },
  });
}
