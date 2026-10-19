import { describe, expect, it } from "vitest";
import type { ChartSpec } from "./chart-options";
import { chartTable, MAX_TABLE_ROWS } from "./chart-table";

const day = (d: number) => Date.UTC(2025, 0, d);

const spec = (overrides: Partial<ChartSpec> = {}): ChartSpec => ({
  title: "Net flow",
  unit: "USD",
  height: 200,
  series: [
    {
      id: "a",
      name: "Europe Retail",
      kind: "column",
      color: "positive",
      t: [day(2), day(3), day(6)],
      values: [1250000, null, -3.5],
    },
    { id: "b", name: "Japan Retail", kind: "column", color: "series-2", t: [day(3), day(6)], values: [0.5, 2] },
  ],
  ...overrides,
});

describe("chartTable", () => {
  it("lists rows newest first with one column per series and the unit in the caption", () => {
    const table = chartTable(spec());
    expect(table.caption).toBe("Net flow (USD)");
    expect(table.columns.map((c) => c.label)).toEqual(["Date", "Europe Retail", "Japan Retail"]);
    expect(table.rows.map((r) => r.cells)).toEqual([
      ["6 Jan 2025", "−3.50", "2.00"],
      ["3 Jan 2025", null, "0.50"],
      ["2 Jan 2025", "1,250,000", null],
    ]);
    expect(table.note).toBeUndefined();
  });

  it("only includes the visible range", () => {
    const table = chartTable(spec({ range: { min: day(3), max: day(5) } }));
    expect(table.rows.map((r) => r.cells[0])).toEqual(["3 Jan 2025"]);
  });

  it("labels intraday times as UTC", () => {
    const table = chartTable(spec({ intraday: true }));
    expect(table.columns[0]?.label).toBe("Time (UTC)");
  });

  it(`caps the rows at ${MAX_TABLE_ROWS} and says so`, () => {
    const t = Array.from({ length: 600 }, (_, i) => day(1) + i * 86_400_000);
    const table = chartTable(
      spec({ series: [{ id: "x", name: "X", kind: "line", color: "series-1", t, values: t.map(() => 1) }] }),
    );
    expect(table.rows).toHaveLength(MAX_TABLE_ROWS);
    expect(table.note).toBe("Showing the latest 500 of 600 rows in this range. Narrow the range to see earlier rows.");
  });
});
