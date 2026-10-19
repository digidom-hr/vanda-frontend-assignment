import { describe, expect, it } from "vitest";
import { cumulative, movingAverage, pctChange, rollingSum, zScore } from "./transforms";
import type { Values } from "./transforms";

/** Compares element-wise, treating null as an exact value and numbers with a relative tolerance. */
function expectClose(actual: Values, expected: Values, relTol = 1e-9): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((a, i) => {
    const e = expected[i];
    if (e === null || e === undefined || a === null || a === undefined) {
      expect(a, `index ${i}`).toBe(e);
      return;
    }
    const tol = relTol * Math.max(1, Math.abs(e));
    expect(Math.abs(a - e), `index ${i}: ${a} vs ${e}`).toBeLessThanOrEqual(tol);
  });
}

describe("rollingSum", () => {
  it("sums the trailing window and leaves warm-up points empty", () => {
    expect(rollingSum([1, 2, 3, 4, 5], 3)).toEqual([null, null, 6, 9, 12]);
  });

  it("returns the input values for a window of 1", () => {
    expect(rollingSum([4, -2, 7], 1)).toEqual([4, -2, 7]);
  });

  it("is empty everywhere when the window is longer than the series", () => {
    expect(rollingSum([1, 2], 5)).toEqual([null, null]);
  });

  it("yields null for any window that contains a gap", () => {
    expect(rollingSum([1, 2, null, 4, 5, 6], 2)).toEqual([null, 3, null, null, 9, 11]);
  });

  it("handles an empty series", () => {
    expect(rollingSum([], 3)).toEqual([]);
  });

  it.each([0, -1, 2.5, Number.NaN])("rejects window %s", (window) => {
    expect(() => rollingSum([1, 2, 3], window)).toThrow(RangeError);
  });
});

describe("movingAverage", () => {
  it("averages the trailing window", () => {
    expect(movingAverage([2, 4, 6, 8], 2)).toEqual([null, 3, 5, 7]);
  });

  it("propagates gaps like rollingSum", () => {
    expect(movingAverage([2, null, 6, 8], 2)).toEqual([null, null, null, 7]);
  });
});

describe("pctChange", () => {
  it("computes percent change versus the previous point", () => {
    expectClose(pctChange([100, 110, 99]), [null, 10, -10]);
  });

  it("supports a longer lookback", () => {
    expectClose(pctChange([100, 50, 200, 75], 2), [null, null, 100, 50]);
  });

  it("keeps the sign meaningful when the base is negative", () => {
    // -100 -> -50 is an increase; -50 -> -100 is a decrease.
    expectClose(pctChange([-100, -50, -100]), [null, 50, -100]);
  });

  it("yields null for a zero base instead of Infinity", () => {
    expect(pctChange([0, 5, 10])).toEqual([null, null, 100]);
  });

  it("yields null when either side is missing", () => {
    expect(pctChange([1, null, 2, 4])).toEqual([null, null, null, 100]);
  });

  it("rejects non-positive periods", () => {
    expect(() => pctChange([1, 2], 0)).toThrow(RangeError);
  });
});

describe("cumulative", () => {
  it("accumulates a running total", () => {
    expect(cumulative([1, -2, 3])).toEqual([1, -1, 2]);
  });

  it("keeps gaps as gaps and carries the total across them", () => {
    expect(cumulative([null, 1, null, 2])).toEqual([null, 1, null, 3]);
  });
});

describe("zScore", () => {
  it("standardises against the full-series mean and sample deviation", () => {
    // mean 5, sample sd = sqrt(32 / 7)
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const sd = Math.sqrt(32 / 7);
    expectClose(
      zScore(values),
      values.map((v) => (v - 5) / sd),
    );
  });

  it("ignores gaps when computing full-series statistics", () => {
    const out = zScore([1, null, 3]);
    expectClose(out, [-1 / Math.SQRT2, null, 1 / Math.SQRT2]);
  });

  it("is empty for a constant series", () => {
    expect(zScore([3, 3, 3, 3])).toEqual([null, null, null, null]);
  });

  it("is empty with fewer than two values", () => {
    expect(zScore([7])).toEqual([null]);
    expect(zScore([null, null])).toEqual([null, null]);
  });

  it("standardises against a trailing window", () => {
    // Window [1,2,3]: mean 2, sd 1 -> z(3) = 1; window [2,3,10]: mean 5, sd sqrt(19).
    expectClose(zScore([1, 2, 3, 10], 3), [null, null, 1, 5 / Math.sqrt(19)]);
  });

  it("yields null for a flat window inside a varying series", () => {
    const out = zScore([1, 50, 7, 7, 7, 7, 900], 4);
    expect(out[5]).toBeNull();
    expect(out[6]).not.toBeNull();
  });

  it("is empty for a rolling window of 1", () => {
    expect(zScore([1, 2, 3], 1)).toEqual([null, null, null]);
  });
});

// --- Reference comparison -------------------------------------------------
// Straightforward O(n * window) implementations, used to check the single-pass
// versions on long, noisy series with gaps and very large magnitudes.

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSeries(length: number, scale: number, gapRate: number, seed: number): (number | null)[] {
  const rand = mulberry32(seed);
  let level = scale;
  return Array.from({ length }, () => {
    level += (rand() - 0.5) * scale * 0.1;
    return rand() < gapRate ? null : level;
  });
}

function windowAt(values: Values, i: number, window: number): number[] | null {
  if (i < window - 1) return null;
  const slice = values.slice(i - window + 1, i + 1);
  return slice.every((v) => typeof v === "number") ? (slice as number[]) : null;
}

const naiveRollingSum = (values: Values, window: number) =>
  values.map((_, i) => windowAt(values, i, window)?.reduce((s, v) => s + v, 0) ?? null);

function naiveRollingZ(values: Values, window: number): (number | null)[] {
  return values.map((v, i) => {
    const w = windowAt(values, i, window);
    if (!w || v === null || v === undefined) return null;
    const mean = w.reduce((s, x) => s + x, 0) / window;
    const sd = Math.sqrt(w.reduce((s, x) => s + (x - mean) ** 2, 0) / (window - 1));
    return sd === 0 ? null : (v - mean) / sd;
  });
}

describe("single-pass transforms match reference implementations", () => {
  const cases = [
    { name: "small scores with gaps", length: 2_000, scale: 1, gapRate: 0.02, seed: 1 },
    { name: "flow-sized magnitudes", length: 2_000, scale: 4e11, gapRate: 0.01, seed: 2 },
    { name: "long intraday-length series", length: 100_000, scale: 4e11, gapRate: 0.001, seed: 3 },
  ];

  it.each(cases)("rollingSum: $name", ({ length, scale, gapRate, seed }) => {
    const values = randomSeries(length, scale, gapRate, seed);
    expectClose(rollingSum(values, 20), naiveRollingSum(values, 20), 1e-6);
  });

  it.each(cases)("rolling zScore: $name", ({ length, scale, gapRate, seed }) => {
    const values = randomSeries(length, scale, gapRate, seed);
    expectClose(zScore(values, 20), naiveRollingZ(values, 20), 1e-6);
  });
});
