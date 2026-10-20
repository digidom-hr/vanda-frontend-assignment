import { describe, expect, it } from "vitest";
import { joinColumns, splitIntoWindows } from "./chunked-range";

describe("splitIntoWindows", () => {
  it("keeps a short period in one piece", () => {
    expect(splitIntoWindows("2025-12-01", "2025-12-31", 1, 5)).toEqual([{ from: "2025-12-01", to: "2025-12-31" }]);
  });

  it("splits a long period into consecutive windows that cover it exactly once", () => {
    // 1 series, 5 fields: 288 bars x 6 values a day, so 173 days a piece.
    const windows = splitIntoWindows("2021-01-04", "2025-12-31", 1, 5);
    expect(windows.length).toBe(11);
    expect(windows[0]).toEqual({ from: "2021-01-04", to: "2021-06-25" });
    expect(windows[1]?.from).toBe("2021-06-26");
    expect(windows.at(-1)?.to).toBe("2025-12-31");
    for (let i = 1; i < windows.length; i++) {
      const gap = Date.parse(windows[i]!.from) - Date.parse(windows[i - 1]!.to);
      expect(gap).toBe(86_400_000); // no gap, no overlap
    }
  });

  it("uses smaller windows for more series and fields", () => {
    expect(splitIntoWindows("2025-01-01", "2025-12-31", 6, 5).length).toBeGreaterThan(
      splitIntoWindows("2025-01-01", "2025-12-31", 1, 5).length,
    );
  });

  it("leaves a range it can't read alone", () => {
    expect(splitIntoWindows("2025-12-31", "2025-01-01", 1, 1)).toEqual([{ from: "2025-12-31", to: "2025-01-01" }]);
  });
});

describe("joinColumns", () => {
  it("joins each series' pieces in date order, field by field", () => {
    const joined = joinColumns([
      [
        { seriesId: "A", t: [1, 2], fields: { price: [10, 11], score: [0, 1] } },
        { seriesId: "B", t: [1], fields: { price: [5], score: [null] } },
      ],
      [
        { seriesId: "A", t: [3], fields: { price: [12], score: [2] } },
        { seriesId: "B", t: [], fields: { price: [], score: [] } },
      ],
    ]);
    expect(joined).toEqual([
      { seriesId: "A", t: [1, 2, 3], fields: { price: [10, 11, 12], score: [0, 1, 2] } },
      { seriesId: "B", t: [1], fields: { price: [5], score: [null] } },
    ]);
  });

  it("returns nothing for no pieces", () => {
    expect(joinColumns([])).toEqual([]);
  });
});
