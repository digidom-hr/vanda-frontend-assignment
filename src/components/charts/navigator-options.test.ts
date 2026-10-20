import { describe, expect, it } from "vitest";
import type { ChartTokens } from "./chart-options";
import { buildNavigatorOptions, NAVIGATOR_HEIGHT, NAVIGATOR_TOTAL_HEIGHT } from "./navigator-options";

const TOKENS = {
  surface: "rgb(255, 255, 255)",
  ink: "rgb(27, 35, 49)",
  graphite: "rgb(91, 100, 114)",
  rule: "rgb(211, 220, 214)",
  grid: "rgb(227, 233, 229)",
  accent: "rgb(99, 25, 161)",
  accentWash: "rgba(99, 25, 161, 0.12)",
  fontFamily: "Archivo",
  colors: {},
} as unknown as ChartTokens;

const spec = { t: [1, 2, 3], values: [10, null, 12] };

describe("buildNavigatorOptions", () => {
  it("draws the whole history, keeping gaps as gaps", () => {
    const options = buildNavigatorOptions(spec, TOKENS);
    expect(options.series).toMatchObject({
      type: "area",
      data: [
        [1, 10],
        [2, null],
        [3, 12],
      ],
    });
  });

  it("marks the selected period with the accent wash, in the design's colours", () => {
    const options = buildNavigatorOptions(spec, TOKENS);
    expect(options.maskFill).toBe(TOKENS.accentWash);
    expect(options.handles).toMatchObject({ backgroundColor: TOKENS.surface, borderColor: TOKENS.ink });
    expect(options.outlineColor).toBe(TOKENS.rule);
  });

  it("reports a range only when a drag ends", () => {
    expect(buildNavigatorOptions(spec, TOKENS).chartOptions?.scrollbar).toMatchObject({ liveRedraw: false });
  });

  it("reserves a fixed height, so placeholders can match it", () => {
    const options = buildNavigatorOptions(spec, TOKENS);
    expect(options.height).toBe(NAVIGATOR_HEIGHT);
    expect(options.chartOptions?.chart?.height).toBe(NAVIGATOR_TOTAL_HEIGHT);
  });

  it("leaves keyboard and screen-reader support to the page's own controls", () => {
    const options = buildNavigatorOptions(spec, TOKENS);
    expect(options.accessibility?.enabled).toBe(false);
    expect(options.chartOptions?.accessibility?.enabled).toBe(false);
  });
});
