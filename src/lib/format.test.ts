import { describe, expect, it } from "vitest";
import { escapeHtml, formatAxisNumber, formatFacetValue, formatTimestamp, formatValue } from "./format";

describe("formatFacetValue", () => {
  it.each([
    ["equity", "Equity"],
    ["single_name", "Single name"],
    ["fx", "Fx"],
    ["North America", "North America"],
    ["Hedge Funds", "Hedge Funds"],
    ["", ""],
  ])("%j -> %j", (input, expected) => {
    expect(formatFacetValue(input)).toBe(expected);
  });
});

describe("number and date formatting", () => {
  it("compacts large axis values and keeps small ones precise", () => {
    expect(formatAxisNumber(12_500)).toBe("12.5K");
    expect(formatAxisNumber(-3_400_000)).toBe("−3.4M");
    expect(formatAxisNumber(250)).toBe("250");
    expect(formatAxisNumber(0.47)).toBe("0.47");
  });

  it("formats values with their unit", () => {
    expect(formatValue(182.4, "USD")).toBe("182.40 USD");
    expect(formatValue(770_387, "USD")).toBe("770,387 USD");
    expect(formatValue(-1_234_000_000, "USD")).toBe("−1.2B USD");
    expect(formatValue(4.567, "%")).toBe("4.57%");
    expect(formatValue(-1.5, "σ")).toBe("−1.50σ");
    expect(formatValue(0.47, "")).toBe("0.47");
    expect(formatValue(null, "USD")).toBe("No data");
    expect(formatValue(Number.NaN, "USD")).toBe("No data");
  });

  it("formats daily and intraday timestamps in UTC", () => {
    expect(formatTimestamp(Date.UTC(2025, 2, 3))).toBe("3 Mar 2025");
    expect(formatTimestamp(Date.UTC(2025, 2, 3, 14, 30), true)).toBe("3 Mar 2025, 14:30 UTC");
    expect(formatTimestamp(Date.UTC(2025, 8, 30, 9, 5), true)).toBe("30 Sep 2025, 09:05 UTC");
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;");
  });
});
