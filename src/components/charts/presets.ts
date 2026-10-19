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
