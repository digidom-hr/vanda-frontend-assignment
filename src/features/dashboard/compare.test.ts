import { describe, expect, it } from "vitest";
import { rebaseTo100 } from "./compare";

describe("rebaseTo100", () => {
  it("indexes the series to 100 at the first value in the visible range", () => {
    expect(rebaseTo100([1, 2, 3, 4], [50, 80, 40, 60], 2)).toEqual([62.5, 100, 50, 75]);
  });

  it("skips gaps and zeros when choosing the base", () => {
    expect(rebaseTo100([1, 2, 3], [null, 0, 20], 1)).toEqual([null, 0, 100]);
  });

  it("is empty when there is no usable base", () => {
    expect(rebaseTo100([1, 2], [5, 6], 3)).toEqual([null, null]);
  });
});
