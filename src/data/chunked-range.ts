/**
 * Long intraday periods load in pieces. One response is capped by the API
 * (about 3 MB, under Vercel's 4.5 MB limit), and the full 5-minute history
 * is about twice that. So the browser asks for consecutive date windows in
 * parallel and joins them: every request stays small, and the chart still
 * gets every point.
 */
import type { SeriesColumns } from "@/services/types";
import { parseTimestamp, toIsoDate } from "@/lib/time";

const DAY_MS = 86_400_000;
/**
 * Values one piece may carry: below the API's 400,000 limit, with room to
 * spare, so a piece is never refused.
 */
const VALUES_PER_PIECE = 300_000;
/** The most 5-minute bars a day can have (round the clock); real markets have fewer. */
const MAX_BARS_PER_DAY = 288;

export interface DateWindow {
  /** YYYY-MM-DD, inclusive. */
  readonly from: string;
  readonly to: string;
}

/**
 * Splits `from`..`to` (inclusive days) into consecutive windows small enough
 * for one response each, assuming the worst case of bars per day: `series`
 * series with `fields` fields each (plus the timestamp).
 */
export function splitIntoWindows(from: string, to: string, series: number, fields: number): DateWindow[] {
  const start = parseTimestamp(from);
  const end = parseTimestamp(to);
  if (start === null || end === null || end < start) return [{ from, to }];
  const valuesPerDay = MAX_BARS_PER_DAY * Math.max(1, series) * (1 + fields);
  const daysPerWindow = Math.max(1, Math.floor(VALUES_PER_PIECE / valuesPerDay));
  const windows: DateWindow[] = [];
  for (let day = start; day <= end; day += daysPerWindow * DAY_MS) {
    windows.push({ from: toIsoDate(day), to: toIsoDate(Math.min(end, day + (daysPerWindow - 1) * DAY_MS)) });
  }
  return windows;
}

/** Joins the pieces of one request (in date order) back into one set of columns per series. */
export function joinColumns(pieces: readonly (readonly SeriesColumns[])[]): SeriesColumns[] {
  const [first, ...rest] = pieces;
  if (!first) return [];
  return first.map((head, index) => {
    const parts = [head, ...rest.map((piece) => piece[index])].filter((p): p is SeriesColumns => p !== undefined);
    const fields: Record<string, (number | null)[]> = {};
    for (const name of Object.keys(head.fields)) fields[name] = parts.flatMap((p) => p.fields[name] ?? []);
    return { seriesId: head.seriesId, t: parts.flatMap((p) => p.t), fields };
  });
}
