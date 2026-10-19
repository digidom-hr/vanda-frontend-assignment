import { describe, expect, it } from "vitest";
import { getService } from "@/services/registry";
import type { SeriesColumns, SeriesMeta } from "@/services/types";
import { fieldPanel, primaryPanel, type PanelContext } from "./panels";

const meta = (id: string): SeriesMeta => ({
  service: "alpha",
  id,
  name: `${id} name`,
  facets: [],
  frequencies: ["daily"],
  unit: "USD",
  fields: ["price"],
});

const cols = (id: string, values: number[]): SeriesColumns => ({
  seriesId: id,
  t: values.map((_, i) => i + 1),
  fields: { price: values },
});

const ctx = (overrides: Partial<PanelContext> = {}): PanelContext => ({
  service: getService("alpha"),
  series: [meta("A")],
  columns: new Map([
    ["A", cols("A", [10, 20, 30, 40])],
    ["B", cols("B", [100, 50, 200, 100])],
  ]),
  frequency: "daily",
  range: { min: 2, max: 4 },
  transforms: [],
  ...overrides,
});

const price = primaryPanel({ field: "price", title: "Price", rebase: true, fill: true });

describe("primaryPanel", () => {
  it("plots one series as an area in its field's unit", () => {
    const spec = price.build(ctx());
    expect(spec?.unit).toBe("USD");
    expect(spec?.series.map((s) => [s.kind, s.values])).toEqual([["area", [10, 20, 30, 40]]]);
    expect(price.subtitle?.(ctx())).toBe("Daily");
  });

  it("rebases compared levels to 100 at the start of the visible range", () => {
    const c = ctx({ series: [meta("A"), meta("B")] });
    const spec = price.build(c);
    expect(spec?.unit).toBe("index");
    expect(spec?.series.map((s) => s.values)).toEqual([
      [50, 100, 150, 200],
      [200, 100, 400, 200],
    ]);
    expect(price.subtitle?.(c)).toBe("Daily, indexed to 100 at the start of the range");
  });

  it("applies transforms, and does not rebase values that are already comparable", () => {
    const c = ctx({ series: [meta("A"), meta("B")], transforms: [{ kind: "pctChange", periods: 1 }] });
    const spec = price.build(c);
    expect(spec?.unit).toBe("%");
    expect(spec?.series[0]?.values).toEqual([null, 100, 50, expect.closeTo(33.33, 2)]);
    expect(price.subtitle?.(c)).toBe("Daily, %Δ");
  });

  it("keeps rebasing after a level-preserving transform", () => {
    const c = ctx({ series: [meta("A"), meta("B")], transforms: [{ kind: "movingAverage", window: 2 }] });
    expect(price.build(c)?.unit).toBe("index");
  });

  it("draws transformed data as a line rather than an area", () => {
    const spec = price.build(ctx({ transforms: [{ kind: "cumulative" }] }));
    expect(spec?.series[0]?.kind).toBe("line");
  });

  it("returns nothing when there is no data", () => {
    expect(price.build(ctx({ columns: new Map() }))).toBeNull();
    expect(price.build(ctx({ series: [] }))).toBeNull();
  });
});

describe("fieldPanel", () => {
  const net = fieldPanel({
    field: "price",
    title: "Net",
    subtitle: "Buy minus sell",
    chart: (base, series) => ({ ...base, series: [{ ...series, kind: "column", color: "positive" }] }),
  });

  it("draws one field of the primary series with the shared chart settings", () => {
    const spec = net.build(ctx({ series: [meta("A"), meta("B")] }));
    expect(spec).toMatchObject({ title: "Net", unit: "USD", height: 180, intraday: false, range: { min: 2, max: 4 } });
    expect(spec?.series.map((s) => [s.id, s.values])).toEqual([["A:price", [10, 20, 30, 40]]]);
    expect(net.subtitle?.(ctx())).toBe("Buy minus sell");
  });

  it("returns nothing without data for the primary series", () => {
    expect(net.build(ctx({ columns: new Map() }))).toBeNull();
  });
});
