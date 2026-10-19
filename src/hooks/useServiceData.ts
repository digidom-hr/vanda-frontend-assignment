import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { CharlieLatestResponse, SeriesListResponse, TimeseriesResponse } from "@/services/api-types";
import type { Frequency } from "@/services/types";

/** A service's series catalog. Catalogs change rarely, so they stay fresh for 10 minutes. */
export function useSeriesList(service: string) {
  return useQuery({
    queryKey: queryKeys.seriesList(service),
    queryFn: ({ signal }) => apiGet<SeriesListResponse>(`${service}/series`, undefined, signal),
    staleTime: 10 * 60_000,
  });
}

export interface TimeseriesParams {
  readonly ids: readonly string[];
  readonly frequency: Frequency;
  /** YYYY-MM-DD, inclusive; omitted for the full history. */
  readonly from?: string;
  readonly to?: string;
  /** Only these fields are sent back, which keeps responses small. */
  readonly fields: readonly string[];
}

/**
 * Columnar timeseries for one request. Idle until there is at least one id.
 * While new parameters load, the previous data stays available (and the
 * panel shows it dimmed) instead of flashing an empty state.
 */
export function useTimeseries(service: string, params: TimeseriesParams | null) {
  return useQuery({
    queryKey: queryKeys.timeseries(service, {
      ids: params?.ids ?? [],
      frequency: params?.frequency ?? "",
      from: params?.from,
      to: params?.to,
      fields: params?.fields,
    }),
    queryFn: ({ signal }) =>
      apiGet<TimeseriesResponse>(
        `${service}/timeseries`,
        {
          ids: params?.ids,
          frequency: params?.frequency,
          from: params?.from,
          to: params?.to,
          fields: params?.fields,
        },
        signal,
      ),
    enabled: params !== null && params.ids.length > 0,
    placeholderData: keepPreviousData,
  });
}

/** Latest value and signal for every charlie series. */
export function useCharlieLatest() {
  return useQuery({
    queryKey: queryKeys.charlieLatest(),
    queryFn: ({ signal }) => apiGet<CharlieLatestResponse>("charlie/latest", undefined, signal),
  });
}
