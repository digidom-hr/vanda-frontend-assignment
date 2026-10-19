import { describe, expect, it } from "vitest";
import { flowChart, levelChart, rankChart, seriesSlot, signedLineChart } from "./presets";

const s = (id: string) => ({ id, name: id, t: [1, 2], values: [1, 2] });

describe("seriesSlot", () => {
  it("assigns slots in order", () => {
    expect([0, 1, 5, 6].map(seriesSlot)).toEqual(["series-1", "series-2", "series-6", "series-1"]);
  });
});

describe("levelChart", () => {
  it("draws one filled series as an area, and unfilled (signed) data as a line", () => {
    const filled = levelChart({ title: "Price", unit: "USD", height: 300, fill: true, series: [s("a")] });
    expect(filled.series.map((x) => [x.kind, x.color])).toEqual([["area", "series-1"]]);
    const signed = levelChart({ title: "Score", unit: "score", height: 300, series: [s("a")] });
    expect(signed.series.map((x) => x.kind)).toEqual(["line"]);
    expect(filled).not.toHaveProperty("fill");
  });

  it("draws several series as lines in slot order", () => {
    const spec = levelChart({
      title: "Price",
      unit: "index",
      height: 300,
      fill: true,
      series: [s("a"), s("b"), s("c")],
    });
    expect(spec.series.map((x) => [x.kind, x.color])).toEqual([
      ["line", "series-1"],
      ["line", "series-2"],
      ["line", "series-3"],
    ]);
  });

  it("passes chart options through", () => {
    const spec = levelChart({ title: "Price", unit: "USD", height: 300, intraday: true, series: [s("a")] });
    expect(spec).toMatchObject({ title: "Price", unit: "USD", height: 300, intraday: true });
  });
});

describe("flowChart", () => {
  it("draws signed columns around a zero line", () => {
    const spec = flowChart({ title: "Net", unit: "USD", height: 200, series: s("n") });
    expect(spec.zeroLine).toBe(true);
    expect(spec.series[0]).toMatchObject({ kind: "column", color: "positive", signed: true });
  });
});

describe("signedLineChart", () => {
  it("draws a line, not an area, with a zero line", () => {
    const spec = signedLineChart({ title: "Score", unit: "score", height: 200, series: s("x") });
    expect([spec.zeroLine, spec.series[0]?.kind]).toEqual([true, "line"]);
  });
});

describe("rankChart", () => {
  it("inverts the axis from 1 to the field size, with whole-number values", () => {
    const spec = rankChart({ title: "Rank", unit: "rank", height: 200, series: s("r"), of: 40 });
    expect(spec).toMatchObject({ invertY: true, yMin: 1, yMax: 40, yTickPositions: [1, 10, 20, 30, 40], decimals: 0 });
  });

  it("draws the raw rank quietly and the trend in the series colour", () => {
    const spec = rankChart({ title: "Rank", unit: "rank", height: 200, series: s("r"), trend: s("t"), of: 40 });
    expect(spec.series.map((x) => [x.id, x.color])).toEqual([
      ["r", "neutral"],
      ["t", "series-1"],
    ]);
  });
});
