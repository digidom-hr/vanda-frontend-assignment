import { describe, expect, it } from "vitest";
import { placeCard } from "./tour-placement";

const viewport = { width: 1000, height: 800 };
const card = { width: 300, height: 200 };

describe("placeCard", () => {
  it("puts the card below the element when it fits", () => {
    expect(placeCard({ top: 100, left: 50, width: 200, height: 40 }, card, viewport)).toEqual({
      top: 152,
      left: 50,
      side: "below",
    });
  });

  it("puts it above when there is no room below", () => {
    expect(placeCard({ top: 600, left: 50, width: 200, height: 100 }, card, viewport)).toEqual({
      top: 388,
      left: 50,
      side: "above",
    });
  });

  it("goes beside a tall element (a sidebar), top-aligned", () => {
    expect(placeCard({ top: 60, left: 16, width: 230, height: 700 }, card, viewport)).toEqual({
      top: 60,
      left: 258,
      side: "right",
    });
    expect(placeCard({ top: 60, left: 680, width: 300, height: 700 }, card, viewport)).toEqual({
      top: 60,
      left: 368,
      side: "left",
    });
  });

  it("falls back to the bottom of the screen when no side has room", () => {
    const phone = { width: 400, height: 800 };
    expect(placeCard({ top: 100, left: 50, width: 300, height: 650 }, card, phone)).toEqual({
      top: 584,
      left: 50,
      side: "overlap",
    });
  });

  it("keeps the card inside the screen horizontally", () => {
    expect(placeCard({ top: 100, left: 900, width: 80, height: 40 }, card, viewport).left).toBe(684);
    expect(placeCard({ top: 100, left: -20, width: 80, height: 40 }, card, viewport).left).toBe(16);
  });
});
