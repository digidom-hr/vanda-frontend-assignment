import { describe, expect, it } from "vitest";
import {
  MAX_SELECTED_SERIES,
  parseIsoDateParam,
  parseSeriesIds,
  parseTransforms,
  resolveRange,
  serializeSeriesIds,
  serializeTransforms,
} from "./url-state";

describe("series ids", () => {
  it("parses, trims and de-duplicates in order", () => {
    expect(parseSeriesIds("A-0001, A-0013,A-0001")).toEqual(["A-0001", "A-0013"]);
  });

  it("drops invalid ids and returns null when nothing is left", () => {
    expect(parseSeriesIds("A-0001,<script>,")).toEqual(["A-0001"]);
    expect(parseSeriesIds(",,")).toBeNull();
    expect(parseSeriesIds("../etc")).toBeNull();
  });

  it(`keeps at most ${MAX_SELECTED_SERIES}`, () => {
    const ids = Array.from({ length: 9 }, (_, i) => `C-000${i + 1}`);
    expect(parseSeriesIds(ids.join(","))).toHaveLength(MAX_SELECTED_SERIES);
  });

  it("round-trips", () => {
    expect(serializeSeriesIds(parseSeriesIds("B-0101,B-0139") ?? [])).toBe("B-0101,B-0139");
  });
});

describe("transforms", () => {
  it("parses every transform code", () => {
    expect(parseTransforms("sum:5,ma:20,pct,pct:5,cum,z,z:60")?.slice(0, 4)).toEqual([
      { kind: "rollingSum", window: 5 },
      { kind: "movingAverage", window: 20 },
      { kind: "pctChange", periods: 1 },
      { kind: "pctChange", periods: 5 },
    ]);
    expect(parseTransforms("cum,z,z:60")).toEqual([
      { kind: "cumulative" },
      { kind: "zScore" },
      { kind: "zScore", window: 60 },
    ]);
  });

  it("drops invalid steps and keeps the valid ones", () => {
    expect(parseTransforms("ma:0,ma:abc,ma:2000,ma:20,boom,cum:3,z:1,ma:1:2")).toEqual([
      { kind: "movingAverage", window: 20 },
    ]);
    expect(parseTransforms("nope")).toBeNull();
  });

  it("caps the chain length", () => {
    expect(parseTransforms("cum,cum,cum,cum,cum,cum")).toHaveLength(4);
  });

  it("round-trips in the shortest form", () => {
    const raw = "ma:20,pct,z:60,cum,sum:5,pct:3,z";
    expect(serializeTransforms(parseTransforms(raw)?.slice(0, 4) ?? [])).toBe("ma:20,pct,z:60,cum");
  });
});

describe("dates", () => {
  it("accepts calendar dates only", () => {
    expect(parseIsoDateParam("2025-07-01")).toBe("2025-07-01");
    expect(parseIsoDateParam("2025-02-30")).toBeNull();
    expect(parseIsoDateParam("yesterday")).toBeNull();
  });
});

describe("resolveRange", () => {
  const extent = { start: Date.UTC(2021, 0, 4), end: Date.UTC(2025, 11, 31) };
  const preset = (p: "1M" | "3M" | "6M" | "1Y" | "3Y" | "All") =>
    resolveRange({ preset: p, from: null, to: null }, extent);

  it("measures presets back from the last data point, not from today", () => {
    expect(preset("1M")).toEqual({ min: Date.UTC(2025, 10, 30), max: extent.end });
    expect(preset("6M")).toEqual({ min: Date.UTC(2025, 5, 30), max: extent.end });
    expect(preset("1Y")).toEqual({ min: Date.UTC(2024, 11, 31), max: extent.end });
    expect(preset("All")).toEqual({ min: extent.start, max: extent.end });
  });

  it("clamps presets longer than the data", () => {
    const short = { start: Date.UTC(2025, 9, 1), end: Date.UTC(2025, 11, 31) };
    expect(resolveRange({ preset: "1Y", from: null, to: null }, short).min).toBe(short.start);
  });

  it("keeps month ends valid (31 Mar minus 1 month is 28/29 Feb)", () => {
    const march = { start: Date.UTC(2020, 0, 1), end: Date.UTC(2025, 2, 31) };
    expect(resolveRange({ preset: "1M", from: null, to: null }, march).min).toBe(Date.UTC(2025, 1, 28));
  });

  it("uses a custom range, including the whole `to` day", () => {
    expect(resolveRange({ preset: "1Y", from: "2025-07-01", to: "2025-07-31" }, extent)).toEqual({
      min: Date.UTC(2025, 6, 1),
      max: Date.UTC(2025, 6, 31, 23, 59, 59, 999),
    });
  });

  it("allows an open-ended custom range and clamps it to the data", () => {
    expect(resolveRange({ preset: "1Y", from: "2019-01-01", to: null }, extent)).toEqual({
      min: extent.start,
      max: extent.end,
    });
  });

  it("falls back to the preset for a reversed or non-overlapping custom range", () => {
    expect(resolveRange({ preset: "All", from: "2025-08-01", to: "2025-07-01" }, extent)).toEqual(preset("All"));
    expect(resolveRange({ preset: "All", from: "2030-01-01", to: "2030-02-01" }, extent)).toEqual(preset("All"));
  });
});
