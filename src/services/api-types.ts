/**
 * Response contracts of the app's own API (`/api/...`). Shared by the route
 * handlers that produce them and the browser code that consumes them.
 */
import type { CharlieLatest } from "./charlie/meta";
import type { Frequency, SeriesColumns, SeriesMeta } from "./types";

export type ApiErrorCode =
  "bad_request" | "not_found" | "too_large" | "timeout" | "unavailable" | "upstream_error" | "internal";

export interface ApiErrorBody {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    /** Whether trying the same request again later might succeed. */
    readonly retryable: boolean;
  };
}

export interface SeriesListResponse {
  readonly service: string;
  readonly series: readonly SeriesMeta[];
}

export interface TimeseriesResponse {
  readonly service: string;
  readonly frequency: Frequency;
  /** Echo of the requested range (`YYYY-MM-DD`), or null when open-ended. */
  readonly from: string | null;
  readonly to: string | null;
  /** In the order the ids were requested; a series with no rows in range has empty columns. */
  readonly series: readonly SeriesColumns[];
}

export interface CharlieLatestResponse {
  readonly latest: readonly CharlieLatest[];
}
