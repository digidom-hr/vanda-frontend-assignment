import { describe, expect, it } from "vitest";
import { highlightPrefixes } from "./highlight";

const marked = (text: string, query: string) =>
  highlightPrefixes(text, query)
    .map((s) => (s.match ? `[${s.text}]` : s.text))
    .join("");

describe("highlightPrefixes", () => {
  it("marks the matched start of each word", () => {
    expect(marked("North America Equity Composite", "north eq")).toBe("[North] America [Eq]uity Composite");
  });

  it("is case-insensitive and keeps the original casing", () => {
    expect(marked("ACME INDUSTRIES Composite", "acme ind")).toBe("[ACME] [IND]USTRIES Composite");
  });

  it("does not mark matches in the middle of a word", () => {
    expect(marked("Vertex Biotech (VERB)", "tech")).toBe("Vertex Biotech (VERB)");
  });

  it("prefers the longest matching query word", () => {
    expect(marked("Japan", "j japan")).toBe("[Japan]");
  });

  it("marks the parts of an id the query spells", () => {
    expect(marked("A-0001", "a 00")).toBe("[A]-[00]01");
  });

  it("returns the text unchanged for an empty query", () => {
    expect(highlightPrefixes("Acme", "  ")).toEqual([{ text: "Acme", match: false }]);
  });
});
