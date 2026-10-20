import { beforeEach, describe, expect, it } from "vitest";
import { LINK_HOVER_STORAGE_KEY, readLinkHover, storeLinkHover } from "./link-hover";

describe("link hover preference", () => {
  beforeEach(() => window.localStorage.clear());

  it("is off until turned on, and remembered", () => {
    expect(readLinkHover()).toBe(false);
    storeLinkHover(true);
    expect(readLinkHover()).toBe(true);
    storeLinkHover(false);
    expect(readLinkHover()).toBe(false);
    expect(window.localStorage.getItem(LINK_HOVER_STORAGE_KEY)).toBeNull();
  });
});
