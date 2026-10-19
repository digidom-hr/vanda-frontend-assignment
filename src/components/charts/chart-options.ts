/**
 * Turns a chart description (what to plot) and the resolved design tokens
 * (how it should look) into Highcharts options. Pure: no Highcharts runtime,
 * no DOM, so it is unit-tested directly.
 *
 * Mark and chrome specs follow the dataviz rules adopted for this app:
 * 2px lines, ~10% area wash, columns capped at 24px with rounded data ends,
 * solid 1px hairline grid, markers >= 8px with a surface ring, one shared
 * tooltip listing every series (value first, name second), text always in
 * text colours, a legend whenever there are two or more series, and never a
 * second y-axis.
 */
// Types come from the Stock build that StockChart renders with (its Axis has Stock-only members).
import type { Options, Point, SeriesOptionsType } from "highcharts/highstock.src";
import { escapeHtml, formatAxisNumber, formatTimestamp, formatValue } from "@/lib/format";

export type SeriesColorRole =
  | "series-1"
  | "series-2"
  | "series-3"
  | "series-4"
  | "series-5"
  | "series-6"
  | "positive"
  | "negative"
  | "neutral"
  | "ink";

export const SERIES_COLOR_ROLES: readonly SeriesColorRole[] = [
  "series-1",
  "series-2",
  "series-3",
  "series-4",
  "series-5",
  "series-6",
  "positive",
  "negative",
  "neutral",
  "ink",
];

export interface ChartSeriesSpec {
  readonly id: string;
  readonly name: string;
  /** line: a level over time; area: a level with a wash; column: per-period amounts; step: ranks and other discrete levels. */
  readonly kind: "line" | "area" | "column" | "step";
  readonly color: SeriesColorRole;
  /** Columns only: values below zero use the negative colour (net flows). */
  readonly signed?: boolean;
  /** A derived overlay (e.g. a moving average) drawn thinner and dashed so it reads as secondary. */
  readonly overlay?: boolean;
  readonly t: readonly number[];
  readonly values: readonly (number | null)[];
}

export interface ChartSpec {
  /** Accessible name of the chart; the visible title lives in the panel header. */
  readonly title: string;
  /** One or two sentences for screen readers: what is plotted and over which period. */
  readonly description?: string;
  /** Unit of the y-axis values, e.g. "USD", "%", "σ", "score". */
  readonly unit: string;
  readonly series: readonly ChartSeriesSpec[];
  readonly height: number;
  readonly intraday?: boolean;
  /** Lower is better (rank 1 at the top). */
  readonly invertY?: boolean;
  readonly yMin?: number;
  readonly yMax?: number;
  readonly yTickPositions?: readonly number[];
  /** Draw an emphasised baseline at zero (signed data). */
  readonly zeroLine?: boolean;
  /** Visible x-range in epoch ms; the full data stays loaded so zooming needs no refetch. */
  readonly range?: { readonly min: number; readonly max: number };
  readonly decimals?: number;
}

/** Concrete colours and font, resolved from the CSS tokens for the active theme. */
export interface ChartTokens {
  readonly surface: string;
  readonly ink: string;
  readonly graphite: string;
  readonly rule: string;
  readonly grid: string;
  readonly fontFamily: string;
  readonly colors: Readonly<Record<SeriesColorRole, string>>;
}

export interface BuildOptions {
  readonly reducedMotion?: boolean;
}

/** Highcharts wants [x, y] tuples for large arrays (objects are slow past ~1,000 points). */
export function toPoints(t: readonly number[], values: readonly (number | null)[]): [number, number | null][] {
  const points = new Array<[number, number | null]>(t.length);
  for (let i = 0; i < t.length; i++) points[i] = [t[i] as number, values[i] ?? null];
  return points;
}

function seriesOptions(spec: ChartSeriesSpec, tokens: ChartTokens): SeriesOptionsType {
  const color = tokens.colors[spec.color];
  const common = {
    id: spec.id,
    name: spec.name,
    color,
    data: toPoints(spec.t, spec.values),
  };

  switch (spec.kind) {
    case "column":
      return {
        ...common,
        type: "column",
        negativeColor: spec.signed ? tokens.colors.negative : undefined,
        threshold: 0,
        maxPointWidth: 24,
        borderRadius: 4,
        borderWidth: 0,
      };
    case "area":
      return {
        ...common,
        type: "area",
        lineWidth: 2,
        fillOpacity: 0.1,
        threshold: null,
      };
    case "step":
      return { ...common, type: "line", step: "left", lineWidth: 2 };
    case "line":
      return spec.overlay
        ? { ...common, type: "line", lineWidth: 1.5, dashStyle: "ShortDash", enableMouseTracking: true }
        : { ...common, type: "line", lineWidth: 2 };
  }
}

/** The shared tooltip: date first, then one row per series with a line key, the value in bold and the name after. */
function tooltipFormatter(spec: ChartSpec, tokens: ChartTokens) {
  return function format(this: Point): string {
    const points = this.points ?? [this];
    const rows = points
      .map((point) => {
        const key = `<span style="display:inline-block;width:12px;height:2px;margin-right:6px;vertical-align:middle;background:${escapeHtml(String(point.color ?? tokens.ink))}"></span>`;
        const value = formatValue(point.y ?? null, spec.unit, spec.decimals);
        return `<div style="display:flex;align-items:center;gap:2px;white-space:nowrap">${key}<b style="color:${tokens.ink};font-weight:600">${escapeHtml(value)}</b><span style="color:${tokens.graphite};margin-left:6px">${escapeHtml(point.series.name)}</span></div>`;
      })
      .join("");
    const header = `<div style="color:${tokens.graphite};margin-bottom:4px">${escapeHtml(formatTimestamp(this.x, spec.intraday))}</div>`;
    return `<div style="font-family:${escapeHtml(tokens.fontFamily)};font-size:12px">${header}${rows}</div>`;
  };
}

export function buildChartOptions(spec: ChartSpec, tokens: ChartTokens, options: BuildOptions = {}): Options {
  const axisLabelStyle = { color: tokens.graphite, fontSize: "11px", fontFamily: tokens.fontFamily };
  const multiSeries = spec.series.length > 1;
  const animation = options.reducedMotion ? false : { duration: 150 };

  return {
    chart: {
      height: spec.height,
      backgroundColor: "transparent",
      style: { fontFamily: tokens.fontFamily },
      spacing: [12, 4, 4, 0],
      animation,
    },
    accessibility: {
      enabled: true,
      description: spec.description,
      point: {
        valueDescriptionFormat: "{xDescription}, {value}",
        // Screen readers hear the same formatting as the tooltip.
        descriptionFormatter: (point) =>
          `${formatTimestamp(point.x, spec.intraday)}, ${formatValue(point.y ?? null, spec.unit, spec.decimals)}, ${point.series.name}.`,
      },
      keyboardNavigation: { enabled: true },
    },
    title: { text: undefined },
    lang: { accessibility: { chartContainerLabel: spec.title } },
    credits: { enabled: false },
    exporting: { enabled: false },
    time: { timezone: "UTC" },
    // This app draws its own shared time rail; per-chart Stock chrome is off.
    navigator: { enabled: false },
    scrollbar: { enabled: false },
    rangeSelector: { enabled: false },
    legend: {
      enabled: multiSeries,
      align: "left",
      verticalAlign: "top",
      margin: 14,
      padding: 0,
      itemStyle: { color: tokens.ink, fontWeight: "500", fontSize: "12px" },
      itemHoverStyle: { color: tokens.ink },
      itemHiddenStyle: { color: tokens.graphite },
      symbolRadius: 2,
    },
    xAxis: {
      type: "datetime",
      // Intraday data skips nights and weekends (no long lines across closed
      // markets); daily data keeps a true calendar axis.
      ordinal: Boolean(spec.intraday),
      min: spec.range?.min,
      max: spec.range?.max,
      lineColor: tokens.rule,
      tickColor: tokens.rule,
      gridLineWidth: 0,
      labels: { style: axisLabelStyle },
      // One date vocabulary on every chart, whatever the tick spacing.
      dateTimeLabelFormats: {
        minute: "%H:%M",
        hour: "%H:%M",
        day: "%e %b",
        week: "%e %b",
        month: "%b %Y",
        year: "%Y",
      },
      crosshair: { color: tokens.graphite, width: 1, dashStyle: "Solid" },
    },
    yAxis: {
      opposite: false,
      title: { text: undefined },
      reversed: spec.invertY,
      min: spec.yMin,
      max: spec.yMax,
      tickPositions: spec.yTickPositions ? [...spec.yTickPositions] : undefined,
      gridLineColor: tokens.grid,
      gridLineWidth: 1,
      gridLineDashStyle: "Solid",
      // Keep the end values labelled; they anchor the reader's sense of range.
      showFirstLabel: true,
      showLastLabel: true,
      labels: {
        style: axisLabelStyle,
        align: "right",
        x: -6,
        formatter() {
          return formatAxisNumber(Number(this.value));
        },
      },
      plotLines: spec.zeroLine ? [{ value: 0, color: tokens.rule, width: 1, zIndex: 3 }] : undefined,
    },
    tooltip: {
      shared: true,
      split: false,
      useHTML: true,
      backgroundColor: tokens.surface,
      borderColor: tokens.rule,
      borderRadius: 6,
      borderWidth: 1,
      shadow: false,
      padding: 8,
      outside: true,
      formatter: tooltipFormatter(spec, tokens),
    },
    plotOptions: {
      series: {
        animation,
        states: { hover: { lineWidthPlus: 0 }, inactive: { opacity: 0.35 } },
        marker: {
          enabled: false,
          // One marker shape for every series; Highcharts would otherwise cycle shapes.
          symbol: "circle",
          radius: 4,
          lineWidth: 2,
          lineColor: tokens.surface,
          states: { hover: { radius: 5, lineWidth: 2, lineColor: tokens.surface } },
        },
        dataGrouping: { enabled: true, groupPixelWidth: 2 },
      },
    },
    series: spec.series.map((s) => seriesOptions(s, tokens)),
  };
}
