/**
 * Query key factory: every cached request has exactly one key shape, so
 * invalidation and prefetching can target families of queries reliably.
 */
export const queryKeys = {
  all: ["api"] as const,
  search: (query: string, limit: number) => [...queryKeys.all, "search", { query, limit }] as const,
  seriesList: (service: string) => [...queryKeys.all, "series", service] as const,
  timeseries: (
    service: string,
    params: { ids: readonly string[]; frequency: string; from?: string; to?: string; fields?: readonly string[] },
  ) => [...queryKeys.all, "timeseries", service, params] as const,
  charlieLatest: () => [...queryKeys.all, "charlie", "latest"] as const,
};
