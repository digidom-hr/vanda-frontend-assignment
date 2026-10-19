import { describe, expect, it } from "vitest";
import type { SeriesMeta } from "@/services/types";
import {
  commonFrequencies,
  compareBlockedReason,
  extentOf,
  fetchWindow,
  resolveFrequency,
  resolveSelection,
} from "./dashboard";

const meta = (id: string, frequencies: SeriesMeta["frequencies"] = ["daily"], unit = "USD"): SeriesMeta => ({
  service: "alpha",
  id,
  name: id,
  facets: [],
  frequencies,
  unit,
  fields: ["price"],
});

const A1 = meta("A-0001", ["daily", "5min"]);
const A2 = meta("A-0002");
const BPS = meta("B-0139", ["daily"], "bps");
const CATALOG = [A1, A2, BPS];

describe("resolveSelection", () => {
  it("keeps requested series that exist, in order", () => {
    expect(resolveSelection(CATALOG, ["A-0002", "A-0001"])).toEqual({ series: [A2, A1], missing: [] });
  });

  it("reports unknown ids", () => {
    expect(resolveSelection(CATALOG, ["A-0002", "X-1"])).toEqual({ series: [A2], missing: ["X-1"] });
  });

  it("falls back to the first series when nothing valid was requested", () => {
    expect(resolveSelection(CATALOG, []).series).toEqual([A1]);
    expect(resolveSelection(CATALOG, ["X-1"])).toEqual({ series: [A1], missing: ["X-1"] });
    expect(resolveSelection([], []).series).toEqual([]);
  });
});

describe("frequencies", () => {
  it("only offers frequencies every shown series has", () => {
    expect(commonFrequencies([A1])).toEqual(["daily", "5min"]);
    expect(commonFrequencies([A1, A2])).toEqual(["daily"]);
  });

  it("uses the requested frequency when possible, else the first common one", () => {
    expect(resolveFrequency([A1], "5min")).toBe("5min");
    expect(resolveFrequency([A1, A2], "5min")).toBe("daily");
    expect(resolveFrequency([A1], null)).toBe("daily");
  });
});

describe("compareBlockedReason", () => {
  it("blocks different units and missing frequencies", () => {
    expect(compareBlockedReason(BPS, A1, "daily")).toBe("Different unit (bps)");
    expect(compareBlockedReason(A2, A1, "5min")).toBe("No 5 min data");
    expect(compareBlockedReason(A2, A1, "daily")).toBeNull();
  });
});

describe("extentOf", () => {
  it("spans every series and ignores empty ones", () => {
    expect(
      extentOf([
        { seriesId: "a", t: [5, 9], fields: {} },
        { seriesId: "b", t: [2, 7], fields: {} },
        { seriesId: "c", t: [], fields: {} },
      ]),
    ).toEqual({ start: 2, end: 9 });
    expect(extentOf([])).toBeNull();
  });
});

describe("fetchWindow", () => {
  const extent = { start: Date.UTC(2021, 0, 4), end: Date.UTC(2025, 11, 31) };
  const sixMonths = { preset: "6M" as const, from: null, to: null };

  it("loads daily and slower data in full", () => {
    expect(fetchWindow("daily", sixMonths, extent)).toEqual({});
    expect(fetchWindow("weekly", sixMonths, null)).toEqual({});
  });

  it("loads intraday data for the visible range only, once the extent is known", () => {
    expect(fetchWindow("5min", sixMonths, extent)).toEqual({ from: "2025-06-30", to: "2025-12-31" });
    expect(fetchWindow("5min", sixMonths, null)).toBeNull();
  });
});
