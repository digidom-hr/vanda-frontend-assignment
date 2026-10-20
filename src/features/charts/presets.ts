/**
 * Chart presets: the "specialised charts" built on the one default chart
 * (`TimeChart` + `buildChartOptions`). Each returns a full ChartSpec with
 * sensible defaults for one kind of data; callers override what they need.
 */
import type { ChartSeriesSpec, ChartSpec, SeriesColorRole } from "./chart-options";

export interface PresetSeries {
  readonly id: string;
  readonly name: string;
  readonly t: readonly number[];
  readonly values: readonly (number | null)[];
}

type Common = Omit<ChartSpec, "series">;

/** Categorical slot for the nth shown series; a series keeps its slot by position in the selection. */
export function seriesSlot(index: number): SeriesColorRole {
  return `series-${(index % 6) + 1}` as SeriesColorRole;
}

/**
 * A value over time. One series is drawn in slot 1, as an area when `fill` is
 * set (levels such as price; never for values that cross zero, where a fill
 * to the axis would mislead); several are drawn as lines in slots 1..6 so
 * they can be compared.
 */
export function levelChart(
  options: Common & { readonly series: readonly PresetSeries[]; readonly fill?: boolean },
): ChartSpec {
  const { fill = false, ...rest } = options;
  const area = fill && options.series.length === 1;
  const series: ChartSeriesSpec[] = options.series.map((s, i) => ({
    ...s,
    kind: area ? "area" : "line",
    color: seriesSlot(i),
  }));
  return { ...rest, series };
}

/** Per-period amounts with a sign (net flows): columns around zero, blue up, red down. */
export function flowChart(options: Common & { readonly series: PresetSeries }): ChartSpec {
  const { series, ...rest } = options;
  return {
    ...rest,
    zeroLine: true,
    series: [{ ...series, kind: "column", color: "positive", signed: true }],
  };
}

/** A value that moves around zero (scores, momentum): a line with a zero baseline, never an area. */
export function signedLineChart(options: Common & { readonly series: PresetSeries }): ChartSpec {
  const { series, ...rest } = options;
  return { ...rest, zeroLine: true, series: [{ ...series, kind: "line", color: "series-1" }] };
}

/**
 * A rank where 1 is best: inverted axis from 1 to `of`, the raw rank as a thin
 * line, and an optional smoothed overlay that shows the trend through the
 * day-to-day noise.
 */
export function rankChart(
  options: Common & { readonly series: PresetSeries; readonly of: number; readonly trend?: PresetSeries },
): ChartSpec {
  const { series, of, trend, ...rest } = options;
  const quarter = Math.max(1, Math.round(of / 4));
  return {
    ...rest,
    invertY: true,
    yMin: 1,
    yMax: of,
    yTickPositions: [1, ...[1, 2, 3].map((k) => k * quarter), of].filter((v, i, a) => a.indexOf(v) === i),
    decimals: 0,
    series: [
      { ...series, kind: "line", color: "neutral" },
      ...(trend ? [{ ...trend, kind: "line" as const, color: "series-1" as const }] : []),
    ],
  };
}
