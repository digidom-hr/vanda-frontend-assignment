import { describe, expect, it } from "vitest";
import { applyTransforms, transformLabel, transformedUnit } from "./pipeline";
import type { TransformSpec } from "./pipeline";

describe("applyTransforms", () => {
  it("returns an equal copy for an empty pipeline", () => {
    const input = [1, null, 3];
    const out = applyTransforms(input, []);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it("applies steps left to right", () => {
    // cumulative [1, 3, 6, 10] then pctChange -> [null, 200, 100, 66.67]
    const out = applyTransforms([1, 2, 3, 4], [{ kind: "cumulative" }, { kind: "pctChange", periods: 1 }]);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeCloseTo(200);
    expect(out[2]).toBeCloseTo(100);
    expect(out[3]).toBeCloseTo(66.6667, 3);
  });

  it("carries warm-up gaps from one step into the next", () => {
    const out = applyTransforms(
      [1, 2, 3, 4],
      [
        { kind: "movingAverage", window: 2 },
        { kind: "rollingSum", window: 2 },
      ],
    );
    expect(out).toEqual([null, null, 4, 6]);
  });

  it("does not mutate its input", () => {
    const input = [1, 2, 3];
    applyTransforms(input, [{ kind: "cumulative" }]);
    expect(input).toEqual([1, 2, 3]);
  });
});

describe("transformLabel", () => {
  it.each<[TransformSpec, string]>([
    [{ kind: "rollingSum", window: 5 }, "Σ(5)"],
    [{ kind: "movingAverage", window: 20 }, "MA(20)"],
    [{ kind: "pctChange", periods: 1 }, "%Δ"],
    [{ kind: "pctChange", periods: 5 }, "%Δ(5)"],
    [{ kind: "cumulative" }, "Cumulative"],
    [{ kind: "zScore" }, "Z-score"],
    [{ kind: "zScore", window: 60 }, "Z(60)"],
  ])("labels %j as %s", (spec, label) => {
    expect(transformLabel(spec)).toBe(label);
  });
});

describe("transformedUnit", () => {
  it("keeps the unit for level-preserving transforms", () => {
    expect(transformedUnit("USD", [{ kind: "movingAverage", window: 3 }, { kind: "cumulative" }])).toBe("USD");
  });

  it("uses the last unit-changing step", () => {
    expect(transformedUnit("USD", [{ kind: "pctChange", periods: 1 }])).toBe("%");
    expect(transformedUnit("USD", [{ kind: "pctChange", periods: 1 }, { kind: "zScore" }])).toBe("σ");
    expect(transformedUnit("bps", [{ kind: "zScore" }, { kind: "movingAverage", window: 5 }])).toBe("σ");
  });
});
