import { describe, expect, it } from "vitest";
import { panelAvailable, type PanelContext } from "@/features/dashboard/panels";
import { getService } from "@/services/registry";
import type { SeriesMeta } from "@/services/types";
import { bravoDashboard } from "./dashboard";

const meta = (id: string, fields: string[], unit = "USD"): SeriesMeta => ({
  service: "bravo",
  id,
  name: id,
  facets: [],
  frequencies: ["daily", "weekly", "monthly"],
  unit,
  fields,
});

const T = [1, 2, 3, 4];
const ctx = (series: SeriesMeta[], overrides: Partial<PanelContext> = {}): PanelContext => ({
  service: getService("bravo"),
  series,
  columns: new Map([["B-1", { seriesId: "B-1", t: T, fields: { net: [10, -20, 30, 5], gross: [100, 80, 0, 50] } }]]),
  frequency: "weekly",
  range: { min: 2, max: 4 },
  transforms: [],
  ...overrides,
});

const panel = (title: string) => {
  const p = bravoDashboard.panels.find((x) => x.title === title);
  if (!p || p.kind === "custom") throw new Error(`no chart panel ${title}`);
  return p;
};

describe("bravo dashboard", () => {
  it("shows gross-flow panels only for series that have gross flow", () => {
    const full = [meta("B-1", ["net", "gross"])];
    const netOnly = [meta("B-139", ["net"], "bps")];
    expect(bravoDashboard.panels.filter((p) => panelAvailable(p, { series: full })).map((p) => p.title)).toEqual([
      "Net flow",
      "Gross flow",
      "Cumulative net flow",
      "Net share of gross",
    ]);
    expect(bravoDashboard.panels.filter((p) => panelAvailable(p, { series: netOnly })).map((p) => p.title)).toEqual([
      "Net flow",
      "Cumulative net flow",
    ]);
  });

  it("draws net flow as signed columns, and as lines when transformed", () => {
    const c = ctx([meta("B-1", ["net", "gross"])]);
    expect(panel("Net flow").build(c)?.series[0]).toMatchObject({ kind: "column", signed: true });
    const transformed = ctx([meta("B-1", ["net", "gross"])], { transforms: [{ kind: "movingAverage", window: 2 }] });
    expect(panel("Net flow").build(transformed)?.series[0]?.kind).toBe("line");
  });

  it("accumulates net flow from the start of the visible range", () => {
    const spec = panel("Cumulative net flow").build(ctx([meta("B-1", ["net", "gross"])]));
    expect(spec?.series[0]?.values).toEqual([null, -20, 10, 15]);
  });

  it("computes net as a share of gross, skipping zero gross", () => {
    const spec = panel("Net share of gross").build(ctx([meta("B-1", ["net", "gross"])]));
    expect(spec?.unit).toBe("%");
    expect(spec?.series[0]?.values).toEqual([10, -25, null, 10]);
  });
});
