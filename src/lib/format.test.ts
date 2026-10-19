import { describe, expect, it } from "vitest";
import { formatFacetValue } from "./format";

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
