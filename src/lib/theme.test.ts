import { afterEach, describe, expect, it } from "vitest";
import {
  applyThemePreference,
  readThemePreference,
  storeThemePreference,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "./theme";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

const runInitScript = () => new Function(THEME_INIT_SCRIPT)();

describe("theme preference", () => {
  it("defaults to system and ignores unknown stored values", () => {
    expect(readThemePreference()).toBe("system");
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(readThemePreference()).toBe("system");
  });

  it("stores pinned themes and clears the key for system", () => {
    storeThemePreference("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    storeThemePreference("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("applies a pinned theme as data-theme and removes it for system", () => {
    applyThemePreference("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    applyThemePreference("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("applies a stored pinned theme before React loads", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    runInitScript();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("leaves the system theme alone for missing or invalid values", () => {
    runInitScript();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    localStorage.setItem(THEME_STORAGE_KEY, "<script>");
    runInitScript();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
