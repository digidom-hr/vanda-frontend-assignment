import { describe, expect, it } from "vitest";
import { centreWindow, moveWindow, nearestIndex, resizeWindow, windowForRange } from "./rail";

describe("nearestIndex", () => {
  const t = [10, 20, 30, 40];
  it.each([
    [0, 0],
    [14, 0],
    [16, 1],
    [30, 2],
    [36, 3],
    [99, 3],
  ])("x=%i -> %i", (x, i) => {
    expect(nearestIndex(t, x)).toBe(i);
  });

  it("is -1 for no data", () => {
    expect(nearestIndex([], 5)).toBe(-1);
  });
});

describe("window arithmetic", () => {
  const w = { start: 10, end: 20 };

  it("moves without changing size and stops at the edges", () => {
    expect(moveWindow(w, 5, 100)).toEqual({ start: 15, end: 25 });
    expect(moveWindow(w, -50, 100)).toEqual({ start: 0, end: 10 });
    expect(moveWindow(w, 500, 100)).toEqual({ start: 90, end: 100 });
  });

  it("resizes one edge and keeps a minimum width", () => {
    expect(resizeWindow(w, "start", 4, 100)).toEqual({ start: 4, end: 20 });
    expect(resizeWindow(w, "start", 30, 100)).toEqual({ start: 19, end: 20 });
    expect(resizeWindow(w, "end", 500, 100)).toEqual({ start: 10, end: 100 });
    expect(resizeWindow(w, "end", 0, 100)).toEqual({ start: 10, end: 11 });
  });

  it("centres a window of the same size on a point", () => {
    expect(centreWindow(w, 50, 100)).toEqual({ start: 45, end: 55 });
    expect(centreWindow(w, 99, 100)).toEqual({ start: 90, end: 100 });
  });
});

describe("windowForRange", () => {
  const DAY = 86_400_000;
  const days = Array.from({ length: 10 }, (_, i) => Date.UTC(2024, 10, 15) + i * DAY); // 15..24 Nov

  it("ends on the last point of the range's final day, not the next day", () => {
    // to=19 Nov means up to 19 Nov 23:59:59.999; nearest-point would pick 20 Nov.
    const w = windowForRange(days, Date.UTC(2024, 10, 16), Date.UTC(2024, 10, 19, 23, 59, 59, 999));
    expect([w.start, w.end]).toEqual([1, 4]);
  });

  it("starts on the range's first day even when intraday data begins later that day", () => {
    // Intraday data starting 16 Nov 14:30 still belongs to the 16 Nov daily point.
    const w = windowForRange(days, Date.UTC(2024, 10, 16, 14, 30), Date.UTC(2024, 10, 24));
    expect([w.start, w.end]).toEqual([1, 9]);
  });

  it("stays inside the data", () => {
    expect(windowForRange(days, Date.UTC(2020, 0, 1), Date.UTC(2030, 0, 1))).toEqual({ start: 0, end: 9 });
  });
});
