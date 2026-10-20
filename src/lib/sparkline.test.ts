import { describe, expect, it } from "vitest";
import { sparklinePaths } from "./sparkline";

const points = (path: string) =>
  [...path.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((m): [number, number] => [Number(m[1]), Number(m[2])]);

describe("sparklinePaths", () => {
  it("scales time across the width and values up the height, lowest at the bottom", () => {
    const paths = sparklinePaths([0, 1, 2], [10, 30, 20], 100, 20);
    expect(points(paths?.line ?? "")).toEqual([
      [0, 18],
      [50, 2],
      [100, 10],
    ]);
  });

  it("closes the area down to the bottom edge", () => {
    expect(sparklinePaths([0, 1], [1, 2], 100, 20)?.area).toMatch(/L100,20L0,20Z$/);
  });

  it("skips missing values and needs at least two", () => {
    expect(points(sparklinePaths([0, 1, 2], [1, null, 3], 100, 20)?.line ?? "")).toHaveLength(2);
    expect(sparklinePaths([0, 1], [1, null], 100, 20)).toBeNull();
    expect(sparklinePaths([], [], 100, 20)).toBeNull();
  });

  it("reduces long series but keeps the spikes", () => {
    const t = Array.from({ length: 1000 }, (_, i) => i);
    const values = t.map((i) => (i === 500 ? 100 : i === 700 ? -100 : 0));
    const paths = sparklinePaths(t, values, 100, 20, 40);
    const ys = points(paths?.line ?? "").map(([, y]) => y);
    expect(ys.length).toBeLessThanOrEqual(40);
    expect(Math.min(...ys)).toBe(2); // the spike up reaches the top
    expect(Math.max(...ys)).toBe(18); // the spike down reaches the bottom
  });
});
