/**
 * Theme preference: "system" follows the OS; "light" and "dark" pin a scheme by
 * setting data-theme on <html>, which tokens.css reads. The preference lives
 * in localStorage, so it is per browser.
 */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyThemePreference(preference: ThemePreference, root: HTMLElement = document.documentElement): void {
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
}

export function storeThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode, blocked); the choice then lasts for this page only.
  }
}

/**
 * Runs in <head> before first paint, so a pinned theme never flashes the OS
 * scheme first. Kept dependency-free and tiny because it blocks rendering.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;
