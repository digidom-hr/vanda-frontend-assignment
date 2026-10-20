/**
 * "Link hover": hovering a date in one chart also marks it in the page's
 * other charts. A viewing preference, so it lives in this browser
 * (localStorage), not in the URL: a shared link shows the same data whoever
 * opens it, with their own way of looking at it. Off by default.
 */
export const LINK_HOVER_STORAGE_KEY = "vanda-timeseries:link-hover";

export function readLinkHover(): boolean {
  try {
    return window.localStorage.getItem(LINK_HOVER_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function storeLinkHover(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(LINK_HOVER_STORAGE_KEY, "on");
    else window.localStorage.removeItem(LINK_HOVER_STORAGE_KEY);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}
