import type { NavigatorOptions, Options } from "highcharts/highstock.src";
import type { ChartTokens } from "./chart-options";

/** Height of the navigator's plot, in pixels. Year labels sit inside it. */
export const NAVIGATOR_HEIGHT = 56;
/** The whole navigator, including Highcharts' 1px top offset. Placeholders reserve exactly this. */
export const NAVIGATOR_TOTAL_HEIGHT = NAVIGATOR_HEIGHT + 2;
/** Space on each side of the plot, so the edge handles aren't clipped. */
const NAVIGATOR_INSET = 6;

export interface NavigatorSpec {
  /** The primary series over its whole history. */
  readonly t: readonly number[];
  readonly values: readonly (number | null)[];
}

/** Options for Highcharts' standalone navigator: navigator options plus the chart it draws in. */
export type StandaloneNavigatorConfig = NavigatorOptions & { readonly chartOptions?: Options };

/**
 * The page's range control: Highcharts' standalone navigator drawn with the
 * design tokens. The selected period is the accent wash, the way Vanda's
 * charts shade a highlighted period. It reports a new range only when a drag ends (no live
 * redraw), so the panels and the URL update once per decision, not per pixel.
 *
 * Highcharts' own accessibility layer is off here: its keyboard handles work
 * in whole percent and re-apply both handles on every key press, so moving one
 * edge drifts the other. `RangeNavigator` provides the keyboard and
 * screen-reader controls instead, in data points and dates.
 */
export function buildNavigatorOptions(spec: NavigatorSpec, tokens: ChartTokens): StandaloneNavigatorConfig {
  // No halo: plain labels like every other chart axis.
  const labelStyle = { color: tokens.graphite, fontSize: "11px", fontFamily: tokens.fontFamily, textOutline: "none" };
  return {
    height: NAVIGATOR_HEIGHT,
    margin: 0,
    maskFill: tokens.accentWash,
    maskInside: true,
    // The selected period reads as one shape: accent edges and accent grips on the wash.
    outlineColor: tokens.accent,
    outlineWidth: 1,
    handles: {
      // Slim rounded grips, filled with the accent. The border matches the
      // fill, so Highcharts' default grip ridges disappear into it.
      backgroundColor: tokens.accent,
      borderColor: tokens.accent,
      lineWidth: 1,
      borderRadius: 4,
      // 24px tall: the WCAG 2.2 minimum target size.
      width: 8,
      height: 24,
    },
    series: {
      type: "area",
      data: spec.t.map((x, i) => [x, spec.values[i] ?? null]),
      color: tokens.graphite,
      fillOpacity: 0.12,
      lineWidth: 1,
      dataGrouping: { enabled: false },
    },
    xAxis: {
      gridLineColor: tokens.rule,
      gridLineWidth: 1,
      // Inside the plot, beside each year's line (Highcharts' default placement).
      labels: { style: labelStyle, align: "left", x: 4, y: -4 },
    },
    accessibility: { enabled: false },
    chartOptions: {
      chart: {
        height: NAVIGATOR_TOTAL_HEIGHT,
        backgroundColor: "transparent",
        style: { fontFamily: tokens.fontFamily },
        spacing: [0, NAVIGATOR_INSET, 0, NAVIGATOR_INSET],
      },
      time: { timezone: "UTC" },
      credits: { enabled: false },
      // Report the range once, when a drag ends. The standalone navigator
      // forces its scrollbar on; 1px (it draws at height - 1, so 0 would be
      // an invalid -1) keeps it out of the layout, and CSS hides it.
      scrollbar: { enabled: false, liveRedraw: false, height: 1 },
      accessibility: { enabled: false },
    },
  };
}
