import { keepPreviousData, queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { apiGet } from "./api-client";
import { joinColumns, splitIntoWindows } from "./chunked-range";
import { queryKeys } from "./query-keys";
import { SERVICES } from "@/services/registry";
import type { CharlieLatestResponse, SeriesListResponse, TimeseriesResponse } from "@/services/api-types";
import type { Frequency } from "@/services/types";

/** A service's series catalog. Catalogs change rarely, so they stay fresh for 10 minutes. */
export function seriesListQuery(service: string) {
  return queryOptions({
    queryKey: queryKeys.seriesList(service),
    queryFn: ({ signal }) => apiGet<SeriesListResponse>(`${service}/series`, undefined, signal),
    staleTime: 10 * 60_000,
  });
}

export function useSeriesList(service: string) {
  return useQuery(seriesListQuery(service));
}

/**
 * Starts loading every catalog in the background. Called once when the app
 * opens, so a sleeping data service starts waking while the visitor is still
 * on the first page, and later pages find their catalog already cached.
 * Failures are ignored here; the page that needs a catalog shows its own state.
 */
export function prefetchCatalogs(client: QueryClient): void {
  for (const service of SERVICES) void client.prefetchQuery(seriesListQuery(service.id));
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

const NO_PARAMS: TimeseriesParams = { ids: [], frequency: "daily", fields: [] };

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
    // Never runs without params (see `enabled`).
    queryFn: ({ signal }) => fetchTimeseries(service, params ?? NO_PARAMS, signal),
    enabled: params !== null && params.ids.length > 0,
    placeholderData: keepPreviousData,
  });
}

/**
 * One timeseries request. A long intraday period (e.g. five years of
 * 5-minute data) is more than one response may carry, so it loads as
 * consecutive date windows in parallel, joined into one response. Daily and
 * slower data always fits in one.
 */
async function fetchTimeseries(
  service: string,
  params: TimeseriesParams,
  signal: AbortSignal,
): Promise<TimeseriesResponse> {
  const get = (from: string | undefined, to: string | undefined) =>
    apiGet<TimeseriesResponse>(
      `${service}/timeseries`,
      { ids: params.ids, frequency: params.frequency, from, to, fields: params.fields },
      signal,
    );
  const windows =
    params.frequency === "5min" && params.from && params.to
      ? splitIntoWindows(params.from, params.to, params.ids.length, params.fields.length)
      : [];
  if (windows.length < 2) return get(params.from, params.to);

  const pieces = await Promise.all(windows.map((w) => get(w.from, w.to)));
  const [first] = pieces;
  return {
    ...first!,
    from: params.from ?? null,
    to: params.to ?? null,
    series: joinColumns(pieces.map((p) => p.series)),
  };
}

/** Latest value and signal for every charlie series. */
export function useCharlieLatest() {
  return useQuery({
    queryKey: queryKeys.charlieLatest(),
    queryFn: ({ signal }) => apiGet<CharlieLatestResponse>("charlie/latest", undefined, signal),
  });
}
