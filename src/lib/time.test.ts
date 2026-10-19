import { describe, expect, it } from "vitest";
import { isIsoDate, parseTimestamp, toIsoDate } from "./time";

describe("parseTimestamp", () => {
  it("reads a calendar date as UTC midnight", () => {
    expect(parseTimestamp("2025-03-03")).toBe(Date.UTC(2025, 2, 3));
  });

  it("reads a UTC date-time", () => {
    expect(parseTimestamp("2025-03-03T14:30:00Z")).toBe(Date.UTC(2025, 2, 3, 14, 30));
    expect(parseTimestamp("2025-03-03T14:30Z")).toBe(Date.UTC(2025, 2, 3, 14, 30));
  });

  it.each(["2025-02-30", "2025-13-01", "2025-3-3", "2025-03-03T14:30:00", "2025-03-03T14:30:00+02:00", "", "today"])(
    "rejects %j",
    (value) => {
      expect(parseTimestamp(value)).toBeNull();
    },
  );

  it("accepts leap days only in leap years", () => {
    expect(parseTimestamp("2024-02-29")).toBe(Date.UTC(2024, 1, 29));
    expect(parseTimestamp("2025-02-29")).toBeNull();
  });
});

describe("toIsoDate / isIsoDate", () => {
  it("formats epoch milliseconds as a UTC date", () => {
    expect(toIsoDate(Date.UTC(2025, 11, 31, 23, 59))).toBe("2025-12-31");
  });

  it("validates calendar dates", () => {
    expect(isIsoDate("2025-12-31")).toBe(true);
    expect(isIsoDate("2025-12-32")).toBe(false);
    expect(isIsoDate("2025-12-31T00:00:00Z")).toBe(false);
  });
});
