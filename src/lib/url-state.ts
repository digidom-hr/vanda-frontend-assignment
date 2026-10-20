/**
 * The URL is the source of truth for what a service page shows, so views can
 * be shared, bookmarked and navigated with back/forward. These functions turn
 * query values into typed state and back. They are lenient: anything invalid
 * (a typo, an old link) is dropped and the page falls back to defaults rather
 * than failing.
 *
 *   ?series=A-0001,A-0013   selected series; the first is the primary one
 *   &freq=5min              frequency
 *   &range=6M               preset, relative to the last data point
 *   &from=2025-07-01&to=…   custom range (from the range navigator); overrides range
 *   &tf=ma:20,pct:1         transform chain, applied left to right
 */
import { isIsoDate, parseTimestamp } from "./time";
import type { TransformSpec } from "./transforms/pipeline";

export const MAX_SELECTED_SERIES = 6;
export const MAX_TRANSFORM_STEPS = 4;
export const MAX_TRANSFORM_WINDOW = 1000;

export const RANGE_PRESETS = ["1M", "3M", "6M", "1Y", "3Y", "All"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export const DEFAULT_RANGE: RangePreset = "1Y";

const SERIES_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

/** Valid, de-duplicated series ids in order, capped at MAX_SELECTED_SERIES; null when none are valid. */
export function parseSeriesIds(raw: string): string[] | null {
  const ids = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => SERIES_ID.test(s)),
    ),
  ];
  return ids.length ? ids.slice(0, MAX_SELECTED_SERIES) : null;
}

export function serializeSeriesIds(ids: readonly string[]): string {
  return ids.join(",");
}

const windowParam = (raw: string | undefined): number | null => {
  if (raw === undefined || !/^\d{1,4}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= MAX_TRANSFORM_WINDOW ? n : null;
};

function parseTransform(item: string): TransformSpec | null {
  const [code, param, ...rest] = item.trim().split(":");
  if (rest.length) return null;
  switch (code) {
    case "sum": {
      const window = windowParam(param);
      return window ? { kind: "rollingSum", window } : null;
    }
    case "ma": {
      const window = windowParam(param);
      return window ? { kind: "movingAverage", window } : null;
    }
    case "pct": {
      const periods = param === undefined ? 1 : windowParam(param);
      return periods ? { kind: "pctChange", periods } : null;
    }
    case "cum":
      return param === undefined ? { kind: "cumulative" } : null;
    case "z": {
      if (param === undefined) return { kind: "zScore" };
      const window = windowParam(param);
      return window && window >= 2 ? { kind: "zScore", window } : null;
    }
    default:
      return null;
  }
}

/** Valid transform steps in order (invalid ones dropped), capped at MAX_TRANSFORM_STEPS; null when none. */
export function parseTransforms(raw: string): TransformSpec[] | null {
  const specs = raw
    .split(",")
    .map(parseTransform)
    .filter((s): s is TransformSpec => s !== null);
  return specs.length ? specs.slice(0, MAX_TRANSFORM_STEPS) : null;
}

function serializeTransform(spec: TransformSpec): string {
  switch (spec.kind) {
    case "rollingSum":
      return `sum:${spec.window}`;
    case "movingAverage":
      return `ma:${spec.window}`;
    case "pctChange":
      return spec.periods === 1 ? "pct" : `pct:${spec.periods}`;
    case "cumulative":
      return "cum";
    case "zScore":
      return spec.window === undefined ? "z" : `z:${spec.window}`;
  }
}

export function serializeTransforms(specs: readonly TransformSpec[]): string {
  return specs.map(serializeTransform).join(",");
}

export function parseIsoDateParam(raw: string): string | null {
  return isIsoDate(raw) ? raw : null;
}

export interface TimeExtent {
  /** Epoch ms of the first and last data points. */
  readonly start: number;
  readonly end: number;
}

export interface RangeSelection {
  readonly preset: RangePreset;
  readonly from: string | null;
  readonly to: string | null;
}

const DAY_MS = 86_400_000;

/** The same day-of-month `months` earlier, clamped to the target month's length (31 Mar - 1M = 28 Feb). */
function minusMonths(ms: number, months: number): number {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() - months; // Date.UTC normalises negative months into earlier years.
  const daysInTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(d.getUTCDate(), daysInTarget), d.getUTCHours(), d.getUTCMinutes());
}

const PRESET_MONTHS: Record<Exclude<RangePreset, "All">, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "3Y": 36 };

/**
 * The visible window in epoch ms. A custom from/to wins when it is valid and
 * overlaps the data; otherwise the preset applies, measured back from the
 * last data point (the data does not run up to today). Always clamped to the
 * data's extent.
 */
export function resolveRange(selection: RangeSelection, extent: TimeExtent): { min: number; max: number } {
  const clamp = (ms: number) => Math.min(extent.end, Math.max(extent.start, ms));

  if (selection.from || selection.to) {
    const from = selection.from ? parseTimestamp(selection.from) : extent.start;
    // `to` is a calendar date; include the whole day (intraday data).
    const toDay = selection.to ? parseTimestamp(selection.to) : null;
    const to = toDay === null ? extent.end : toDay + DAY_MS - 1;
    if (from !== null && from <= to && from <= extent.end && to >= extent.start) {
      return { min: clamp(from), max: clamp(to) };
    }
  }

  if (selection.preset === "All") return { min: extent.start, max: extent.end };
  return { min: clamp(minusMonths(extent.end, PRESET_MONTHS[selection.preset])), max: extent.end };
}
