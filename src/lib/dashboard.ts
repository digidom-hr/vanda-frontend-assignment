/**
 * Pure rules behind a service dashboard: which series are shown, at which
 * frequency, what may join a comparison, and what data window to fetch.
 */
import type { Frequency, SeriesColumns, SeriesMeta } from "@/services/types";
import { toIsoDate } from "./time";
import { resolveRange, type RangeSelection, type TimeExtent } from "./url-state";

export interface Selection {
  /** Shown series in order; the first is primary. Empty only when the catalog is empty. */
  readonly series: SeriesMeta[];
  /** Requested ids that the catalog doesn't contain (stale or mistyped links). */
  readonly missing: string[];
}

/** The URL's series that exist, or the catalog's first series when none do. */
export function resolveSelection(catalog: readonly SeriesMeta[], requested: readonly string[]): Selection {
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const series = requested.map((id) => byId.get(id)).filter((s): s is SeriesMeta => s !== undefined);
  const missing = requested.filter((id) => !byId.has(id));
  if (series.length === 0 && catalog[0]) series.push(catalog[0]);
  return { series, missing };
}

/** Frequencies every shown series has, in the primary series' order. */
export function commonFrequencies(series: readonly SeriesMeta[]): Frequency[] {
  const [primary, ...rest] = series;
  if (!primary) return [];
  return primary.frequencies.filter((f) => rest.every((s) => s.frequencies.includes(f)));
}

/** The requested frequency if every shown series has it, else the first common one. */
export function resolveFrequency(series: readonly SeriesMeta[], requested: Frequency | null): Frequency {
  const common = commonFrequencies(series);
  if (requested && common.includes(requested)) return requested;
  return common[0] ?? series[0]?.frequencies[0] ?? "daily";
}

const FREQUENCY_NAMES: Record<Frequency, string> = {
  "5min": "5 min",
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
};

/** Why `candidate` can't join a comparison with `primary` at `frequency`, or null if it can. */
export function compareBlockedReason(
  candidate: SeriesMeta,
  primary: SeriesMeta | undefined,
  frequency: Frequency,
): string | null {
  if (!primary) return null;
  if (candidate.unit !== primary.unit) return `Different unit (${candidate.unit})`;
  if (!candidate.frequencies.includes(frequency)) return `No ${FREQUENCY_NAMES[frequency]} data`;
  return null;
}

/** First and last timestamps across the given columns, or null when there is no data. */
export function extentOf(columns: readonly SeriesColumns[]): TimeExtent | null {
  let start = Infinity;
  let end = -Infinity;
  for (const c of columns) {
    if (c.t.length === 0) continue;
    start = Math.min(start, c.t[0] as number);
    end = Math.max(end, c.t[c.t.length - 1] as number);
  }
  return Number.isFinite(start) ? { start, end } : null;
}

/**
 * The date window to request. Daily and slower data is small enough to load
 * in full (zooming is then instant); intraday data is loaded for the visible
 * range only, because the full 5-minute history exceeds the response budget.
 */
export function fetchWindow(
  frequency: Frequency,
  selection: RangeSelection,
  extent: TimeExtent | null,
): { from?: string; to?: string } | null {
  if (frequency !== "5min") return {};
  if (!extent) return null; // wait for the extent before requesting intraday data
  const { min, max } = resolveRange(selection, extent);
  return { from: toIsoDate(min), to: toIsoDate(max) };
}
