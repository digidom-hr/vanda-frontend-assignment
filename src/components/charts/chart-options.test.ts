import { describe, expect, it } from "vitest";
import { buildChartOptions, toPoints, type ChartSeriesSpec, type ChartSpec, type ChartTokens } from "./chart-options";

const TOKENS: ChartTokens = {
  surface: "rgb(255, 255, 255)",
  ink: "rgb(27, 35, 49)",
  graphite: "rgb(91, 100, 114)",
  rule: "rgb(211, 220, 214)",
  grid: "rgb(227, 233, 229)",
  fontFamily: "Archivo",
  colors: {
    "series-1": "#2a78d6",
    "series-2": "#eb6834",
    "series-3": "#1baf7a",
    "series-4": "#6250d6",
    "series-5": "#008300",
    "series-6": "#e87ba4",
    positive: "#2a78d6",
    negative: "#e34948",
    neutral: "#8a938e",
    ink: "#1b2331",
  },
};

const T = [Date.UTC(2025, 0, 2), Date.UTC(2025, 0, 3), Date.UTC(2025, 0, 6)];

const series = (overrides: Partial<ChartSeriesSpec> = {}): ChartSeriesSpec => ({
  id: "A-0001:price",
  name: "Acme Corp",
  kind: "line",
  color: "series-1",
  t: T,
  values: [1, null, 3],
  ...overrides,
});

const spec = (overrides: Partial<ChartSpec> = {}): ChartSpec => ({
  title: "Price",
  unit: "USD",
  height: 240,
  series: [series()],
  ...overrides,
});

// Highcharts options are deeply optional unions; read nested values loosely in assertions.
const get = (value: unknown, ...path: (string | number)[]): unknown =>
  path.reduce<unknown>((v, key) => (v as Record<string | number, unknown> | undefined)?.[key], value);

describe("toPoints", () => {
  it("zips timestamps and values into [x, y] tuples, keeping gaps as null", () => {
    expect(toPoints(T, [1, null, 3])).toEqual([
      [T[0], 1],
      [T[1], null],
      [T[2], 3],
    ]);
  });
});

describe("buildChartOptions", () => {
  it("draws 2px lines in the slot colour with markers hidden until hover", () => {
    const options = buildChartOptions(spec(), TOKENS);
    expect(get(options, "series", 0)).toMatchObject({ type: "line", lineWidth: 2, color: "#2a78d6" });
    expect(get(options, "plotOptions", "series", "marker")).toMatchObject({
      enabled: false,
      symbol: "circle",
      radius: 4,
      lineColor: TOKENS.surface,
    });
  });

  it("draws areas as a light wash", () => {
    const options = buildChartOptions(spec({ series: [series({ kind: "area" })] }), TOKENS);
    expect(get(options, "series", 0)).toMatchObject({ type: "area", fillOpacity: 0.1 });
  });

  it("caps column width, rounds data ends and colours negative values for signed data", () => {
    const options = buildChartOptions(
      spec({ series: [series({ kind: "column", color: "positive", signed: true })] }),
      TOKENS,
    );
    expect(get(options, "series", 0)).toMatchObject({
      type: "column",
      maxPointWidth: 24,
      borderRadius: 4,
      color: "#2a78d6",
      negativeColor: "#e34948",
      threshold: 0,
    });
  });

  it("draws ranks as a step line on an inverted axis", () => {
    const options = buildChartOptions(
      spec({ series: [series({ kind: "step" })], invertY: true, yTickPositions: [1, 10, 20, 30, 40] }),
      TOKENS,
    );
    expect(get(options, "series", 0)).toMatchObject({ type: "line", step: "left" });
    expect(get(options, "yAxis")).toMatchObject({ reversed: true, tickPositions: [1, 10, 20, 30, 40] });
  });

  it("draws overlays (e.g. moving averages) thinner and dashed", () => {
    const options = buildChartOptions(spec({ series: [series(), series({ id: "ma", overlay: true })] }), TOKENS);
    expect(get(options, "series", 1)).toMatchObject({ lineWidth: 1.5, dashStyle: "ShortDash" });
  });

  it("shows a legend only for two or more series", () => {
    expect(get(buildChartOptions(spec(), TOKENS), "legend", "enabled")).toBe(false);
    const two = spec({ series: [series(), series({ id: "b", color: "series-2" })] });
    expect(get(buildChartOptions(two, TOKENS), "legend", "enabled")).toBe(true);
  });

  it("uses one y-axis with a solid hairline grid and themed labels", () => {
    const yAxis = get(buildChartOptions(spec(), TOKENS), "yAxis");
    expect(Array.isArray(yAxis)).toBe(false);
    expect(yAxis).toMatchObject({ gridLineWidth: 1, gridLineDashStyle: "Solid", gridLineColor: TOKENS.grid });
    expect(get(yAxis, "labels", "style", "color")).toBe(TOKENS.graphite);
  });

  it("adds a zero baseline for signed data", () => {
    const options = buildChartOptions(spec({ zeroLine: true }), TOKENS);
    expect(get(options, "yAxis", "plotLines", 0)).toMatchObject({ value: 0, width: 1 });
  });

  it("turns off per-chart Stock chrome; the page has one shared time rail", () => {
    const options = buildChartOptions(spec(), TOKENS);
    expect([options.navigator?.enabled, options.scrollbar?.enabled, options.rangeSelector?.enabled]).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("applies a visible range without dropping data outside it", () => {
    const options = buildChartOptions(spec({ range: { min: T[1] as number, max: T[2] as number } }), TOKENS);
    expect(get(options, "xAxis")).toMatchObject({ min: T[1], max: T[2] });
    expect(get(options, "series", 0, "data")).toHaveLength(3);
  });

  it("keeps the chart accessible: named, described and keyboard navigable", () => {
    const options = buildChartOptions(spec({ description: "Daily close since 2021." }), TOKENS);
    expect(options.accessibility).toMatchObject({
      enabled: true,
      description: "Daily close since 2021.",
      keyboardNavigation: { enabled: true },
    });
    expect(get(options, "lang", "accessibility", "chartContainerLabel")).toBe("Price");
  });

  it("disables animation when the user prefers reduced motion", () => {
    expect(get(buildChartOptions(spec(), TOKENS, { reducedMotion: true }), "chart", "animation")).toBe(false);
    expect(get(buildChartOptions(spec(), TOKENS), "chart", "animation")).toEqual({ duration: 150 });
  });

  describe("tooltip", () => {
    type Formatter = (this: unknown) => string;
    const format = (s: ChartSpec, context: unknown) =>
      (get(buildChartOptions(s, TOKENS), "tooltip", "formatter") as Formatter).call(context);
    const point = (y: number | null, name: string, color = "#2a78d6") => ({ y, color, series: { name } });

    it("lists every series at the hovered date, value first, in text colours", () => {
      const html = format(spec(), {
        x: T[0],
        points: [point(182.4, "Acme Corp"), point(-1.5, "Lumen", "#eb6834")],
      });
      expect(html).toContain("2 Jan 2025");
      expect(html.indexOf("182.40 USD")).toBeLessThan(html.indexOf("Acme Corp"));
      expect(html).toContain("−1.50 USD");
      // The value is in ink; the series colour only appears on the line key.
      expect(html).toMatch(/<b style="color:rgb\(27, 35, 49\)/);
    });

    it("shows intraday times in UTC", () => {
      expect(format(spec({ intraday: true }), { x: Date.UTC(2025, 0, 2, 14, 30), points: [point(1, "A")] })).toContain(
        "2 Jan 2025, 14:30 UTC",
      );
    });

    it("escapes series names, which come from upstream data", () => {
      const html = format(spec(), { x: T[0], points: [point(1, "<img src=x onerror=alert(1)>")] });
      expect(html).not.toContain("<img");
      expect(html).toContain("&lt;img");
    });
  });
});
