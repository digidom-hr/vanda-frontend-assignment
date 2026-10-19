// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseCharlieLatest } from "@/services/charlie/adapter";
import { SERVICES } from "@/services/registry";
import { ColumnsBuilder } from "./adapter-kit";
import { ADAPTERS } from "./adapters";
import { UpstreamError } from "./errors";

const day = (d: string) => Date.parse(`${d}T00:00:00Z`);

function expectInvalid(fn: () => unknown, message: RegExp): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).kind).toBe("invalid_response");
    expect((error as UpstreamError).message).toMatch(message);
    return;
  }
  throw new Error("expected an invalid_response error");
}

describe("ADAPTERS", () => {
  it("has an adapter for every registered service", () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual(SERVICES.map((s) => s.id).sort());
  });
});

describe("ColumnsBuilder", () => {
  it("merges long rows by timestamp, sorts by time and fills missing values with null", () => {
    const b = new ColumnsBuilder(["net", "gross"]);
    b.set("S", 30, "net", 3);
    b.set("S", 10, "net", 1);
    b.set("S", 10, "gross", 11);
    b.set("S", 20, "gross", 22);
    expect(b.build()).toEqual([
      { seriesId: "S", t: [10, 20, 30], fields: { net: [1, null, 3], gross: [11, 22, null] } },
    ]);
  });

  it("keeps series in first-seen order and ignores unknown keys", () => {
    const b = new ColumnsBuilder(["value"]);
    b.set("B", 1, "value", 1);
    b.set("A", 1, "value", 2);
    b.set("A", 1, "other", 99);
    expect(b.build().map((s) => [s.seriesId, s.fields])).toEqual([
      ["B", { value: [1] }],
      ["A", { value: [2] }],
    ]);
  });
});

describe("alpha adapter", () => {
  const series = {
    series_id: "A-0001",
    name: "Acme Corp (ACMC)",
    group: "Technology",
    frequencies: ["daily", "5min"],
    unit: "USD",
  };
  const row = (ts: string, id: string, price: number) => ({
    ts,
    series_id: id,
    price,
    price_change: 0.6,
    buy_value: 12000000,
    sell_value: 11000000,
    net_value: 1000000,
    total_value: 23000000,
    group_net_value: 210000,
    score: 0.8,
    momentum: 1.4,
    rank: 112,
  });

  it("maps series to the shared catalog shape", () => {
    expect(ADAPTERS.alpha.parseSeries([series])).toEqual([
      {
        service: "alpha",
        id: "A-0001",
        name: "Acme Corp (ACMC)",
        facets: [{ key: "group", label: "Sector", value: "Technology" }],
        frequencies: ["daily", "5min"],
        unit: "USD",
        fields: [
          "price",
          "price_change",
          "buy_value",
          "sell_value",
          "net_value",
          "total_value",
          "group_net_value",
          "score",
          "momentum",
          "rank",
        ],
      },
    ]);
  });

  it("drops frequencies it does not know, and series left with none", () => {
    const [first, ...rest] = ADAPTERS.alpha.parseSeries([
      { ...series, frequencies: ["1min", "daily"] },
      { ...series, series_id: "A-0002", frequencies: ["1min"] },
    ]);
    expect(first?.frequencies).toEqual(["daily"]);
    expect(rest).toEqual([]);
  });

  it("groups rows into one column set per series", () => {
    const cols = ADAPTERS.alpha.toColumns(
      [row("2025-03-03", "A-0001", 1), row("2025-03-03", "A-0002", 2), row("2025-03-04", "A-0001", 3)],
      "daily",
    );
    expect(cols.map((c) => [c.seriesId, c.t, c.fields.price])).toEqual([
      ["A-0001", [day("2025-03-03"), day("2025-03-04")], [1, 3]],
      ["A-0002", [day("2025-03-03")], [2]],
    ]);
    expect(Object.keys(cols[0]?.fields ?? {})).toHaveLength(10);
  });

  it("parses intraday timestamps", () => {
    const [cols] = ADAPTERS.alpha.toColumns([row("2025-03-03T14:30:00Z", "A-0001", 1)], "5min");
    expect(cols?.t).toEqual([Date.UTC(2025, 2, 3, 14, 30)]);
  });

  it("rejects a row with a non-numeric field, naming where", () => {
    expectInvalid(
      () =>
        ADAPTERS.alpha.toColumns(
          [row("2025-03-03", "A-0001", 1), { ...row("2025-03-04", "A-0001", 1), price: "1" }],
          "daily",
        ),
      /alpha timeseries: .* at 1\.price/,
    );
  });

  it("rejects an invalid timestamp", () => {
    expectInvalid(() => ADAPTERS.alpha.toColumns([row("2025-02-30", "A-0001", 1)], "daily"), /invalid timestamp/);
  });

  it("rejects a malformed catalog", () => {
    expectInvalid(() => ADAPTERS.alpha.parseSeries([{ ...series, name: 42 }]), /alpha series: .* at 0\.name/);
  });
});

describe("bravo adapter", () => {
  const series = {
    series_id: "B-0101",
    name: "North America Retail Activity",
    region: "North America",
    category: "Retail",
    metrics: ["net", "gross"],
    frequencies: ["daily", "weekly", "monthly"],
    unit: "USD",
  };
  const row = (ts: string, metric: string, value: number, frequency = "daily") => ({
    ts,
    series_id: "B-0101",
    metric,
    frequency,
    value,
    unit: "USD",
  });

  it("maps metrics to fields and region/category to facets", () => {
    const [meta] = ADAPTERS.bravo.parseSeries([series]);
    expect(meta?.fields).toEqual(["net", "gross"]);
    expect(meta?.facets.map((f) => f.value)).toEqual(["North America", "Retail"]);
  });

  it("keeps the series' own unit (net-only bps series)", () => {
    const [meta] = ADAPTERS.bravo.parseSeries([{ ...series, metrics: ["net"], unit: "bps" }]);
    expect(meta?.fields).toEqual(["net"]);
    expect(meta?.unit).toBe("bps");
  });

  it("pivots one-row-per-metric data into aligned columns", () => {
    const [cols] = ADAPTERS.bravo.toColumns(
      [row("2025-03-03", "gross", 500), row("2025-03-03", "net", 100), row("2025-03-04", "net", -50)],
      "daily",
    );
    expect(cols).toEqual({
      seriesId: "B-0101",
      t: [day("2025-03-03"), day("2025-03-04")],
      fields: { net: [100, -50], gross: [500, null] },
    });
  });

  it("ignores metrics it does not know", () => {
    const [cols] = ADAPTERS.bravo.toColumns([row("2025-03-03", "net", 1), row("2025-03-03", "spread", 9)], "daily");
    expect(cols?.fields).toEqual({ net: [1], gross: [null] });
  });

  it("rejects rows of a different frequency than requested", () => {
    expectInvalid(() => ADAPTERS.bravo.toColumns([row("2025-03-07", "net", 1, "weekly")], "daily"), /asked for daily/);
  });
});

describe("charlie adapter", () => {
  it("maps series and rows", () => {
    const [meta] = ADAPTERS.charlie.parseSeries([
      {
        series_id: "C-0001",
        name: "North America Equity Composite",
        category: "equity",
        frequencies: ["daily"],
        unit: "score",
      },
    ]);
    expect(meta?.facets).toEqual([{ key: "category", label: "Category", value: "equity" }]);
    expect(meta?.fields).toEqual(["value"]);

    const [cols] = ADAPTERS.charlie.toColumns(
      [{ ts: "2025-03-03", series_id: "C-0001", value: 0.47, unit: "score" }],
      "daily",
    );
    expect(cols).toEqual({ seriesId: "C-0001", t: [day("2025-03-03")], fields: { value: [0.47] } });
  });

  it("parses the latest-values endpoint", () => {
    expect(
      parseCharlieLatest([
        {
          series_id: "C-0001",
          name: "North America Equity Composite",
          category: "equity",
          ts: "2025-12-31",
          value: 1.2,
          unit: "score",
          signal: "high",
        },
      ]),
    ).toEqual([
      {
        seriesId: "C-0001",
        name: "North America Equity Composite",
        category: "equity",
        t: day("2025-12-31"),
        value: 1.2,
        unit: "score",
        signal: "high",
      },
    ]);
  });

  it("rejects an unknown signal", () => {
    expectInvalid(
      () =>
        parseCharlieLatest([
          { series_id: "C-1", name: "X", category: "fx", ts: "2025-12-31", value: 1, unit: "score", signal: "extreme" },
        ]),
      /charlie latest/,
    );
  });
});
