import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGestureSession, panSpan, wheelPixels, wheelZoomFactor, zoomSpan } from "./range-gestures";

const extent = { min: 0, max: 1000 };

describe("zoomSpan", () => {
  it("zooms around the anchor, keeping it at the same place", () => {
    // Anchor at 75% of 200..600; halving the width keeps it at 75%.
    expect(zoomSpan({ min: 200, max: 600 }, extent, 0.5, 500, 10)).toEqual({ min: 350, max: 550 });
  });

  it("never zooms in past the minimum width or out past the whole history", () => {
    expect(zoomSpan({ min: 200, max: 220 }, extent, 0.1, 210, 10)).toEqual({ min: 205, max: 215 });
    expect(zoomSpan({ min: 200, max: 600 }, extent, 10, 400, 10)).toEqual({ min: 0, max: 1000 });
  });

  it("stays inside the history when zooming out near an end", () => {
    expect(zoomSpan({ min: 900, max: 1000 }, extent, 2, 1000, 10)).toEqual({ min: 800, max: 1000 });
  });

  it("keeps the nearest end in place when the anchor is outside the range", () => {
    // Pointer right of the window on the navigator: the window's end stays put.
    expect(zoomSpan({ min: 200, max: 400 }, extent, 0.5, 900, 10)).toEqual({ min: 300, max: 400 });
    expect(zoomSpan({ min: 200, max: 400 }, extent, 0.5, 50, 10)).toEqual({ min: 200, max: 300 });
  });
});

describe("panSpan", () => {
  it("moves the range and keeps its width", () => {
    expect(panSpan({ min: 200, max: 400 }, extent, 150)).toEqual({ min: 350, max: 550 });
  });

  it("stops at the ends of the history", () => {
    expect(panSpan({ min: 200, max: 400 }, extent, -500)).toEqual({ min: 0, max: 200 });
    expect(panSpan({ min: 700, max: 900 }, extent, 500)).toEqual({ min: 800, max: 1000 });
  });
});

describe("wheelZoomFactor", () => {
  it("zooms in when scrolling up and out when scrolling down", () => {
    expect(wheelZoomFactor(-100)).toBeLessThan(1);
    expect(wheelZoomFactor(100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100) * wheelZoomFactor(-100)).toBeCloseTo(1);
  });

  it("adds up small steps to the same zoom as one big one", () => {
    expect(wheelZoomFactor(10) ** 10).toBeCloseTo(wheelZoomFactor(100));
  });
});

describe("wheelPixels", () => {
  it("converts line and page deltas to pixels", () => {
    expect(wheelPixels(3, 0)).toBe(3);
    expect(wheelPixels(3, 1)).toBe(120);
    expect(wheelPixels(1, 2)).toBe(800);
  });
});

describe("createGestureSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = () => {
    const show = vi.fn();
    // The page rounds to multiples of 100 (like whole days).
    const commit = vi.fn((s: { min: number; max: number }) => ({
      min: Math.floor(s.min / 100) * 100,
      max: Math.ceil(s.max / 100) * 100,
    }));
    return { show, commit, session: createGestureSession(show, commit, 250) };
  };

  it("builds each step on the range reached so far, not on the rounded page range", () => {
    const { session } = setup();
    const page = { min: 0, max: 500 };
    expect(session.current(page)).toBe(page);
    session.move({ min: 10, max: 510 });
    session.move(panSpan(session.current(page), extent, 10));
    expect(session.current(page)).toEqual({ min: 20, max: 520 });
  });

  it("shows the latest range once per frame", () => {
    const { session, show } = setup();
    session.move({ min: 10, max: 510 });
    session.move({ min: 20, max: 520 });
    expect(show).not.toHaveBeenCalled();
    vi.advanceTimersToNextFrame();
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith({ min: 20, max: 520 });
  });

  it("commits once when the gesture settles, then shows the page's range", () => {
    const { session, show, commit } = setup();
    session.move({ min: 10, max: 510 });
    session.endSoon();
    session.move({ min: 20, max: 520 });
    session.endSoon();
    vi.advanceTimersByTime(249);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith({ min: 20, max: 520 });
    expect(show).toHaveBeenLastCalledWith({ min: 0, max: 600 });
    expect(session.current({ min: 0, max: 600 })).toEqual({ min: 0, max: 600 });
  });

  it("commits nothing when nothing moved or after a cancel", () => {
    const { session, commit } = setup();
    session.end();
    session.move({ min: 10, max: 510 });
    session.endSoon();
    session.cancel();
    vi.advanceTimersByTime(1000);
    expect(commit).not.toHaveBeenCalled();
  });
});
