import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { SearchResponse } from "@/services/api-types";

export const SEARCH_LIMIT = 20;

/** Cross-service search. Idle for an empty query; keeps showing the previous results while the next ones load. */
export function useSearch(query: string, limit = SEARCH_LIMIT) {
  const q = query.trim();
  return useQuery({
    queryKey: queryKeys.search(q, limit),
    queryFn: ({ signal }) => apiGet<SearchResponse>("search", { q, limit }, signal),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
