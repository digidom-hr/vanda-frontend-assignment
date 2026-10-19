import { describe, expect, it } from "vitest";
import { levelChart, seriesSlot } from "./presets";

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
