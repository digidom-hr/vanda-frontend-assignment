"use client";

import { useSyncExternalStore } from "react";
import { SERIES_COLOR_ROLES, type ChartTokens, type SeriesColorRole } from "./chart-options";

const ROLE_TOKEN: Record<SeriesColorRole, string> = {
  "series-1": "--color-series-1",
  "series-2": "--color-series-2",
  "series-3": "--color-series-3",
  "series-4": "--color-series-4",
  "series-5": "--color-series-5",
  "series-6": "--color-series-6",
  positive: "--color-positive",
  negative: "--color-negative",
  neutral: "--color-neutral",
  ink: "--color-ink",
};

/**
 * Reads design tokens as concrete colours. Custom properties come back from
 * getComputedStyle as unresolved text (light-dark(), var() chains), so each
 * token is painted onto a hidden probe and its computed colour read instead.
 */
export function resolveChartTokens(root: HTMLElement = document.documentElement): ChartTokens {
  const probe = document.createElement("span");
  probe.style.display = "none";
  root.appendChild(probe);
  const read = (token: string) => {
    probe.style.color = `var(${token})`;
    return getComputedStyle(probe).color;
  };
  try {
    const colors = Object.fromEntries(SERIES_COLOR_ROLES.map((role) => [role, read(ROLE_TOKEN[role])])) as Record<
      SeriesColorRole,
      string
    >;
    return {
      surface: read("--color-surface"),
      ink: read("--color-ink"),
      graphite: read("--color-graphite"),
      rule: read("--color-rule"),
      grid: read("--color-grid"),
      fontFamily: getComputedStyle(document.body).fontFamily,
      colors,
    };
  } finally {
    probe.remove();
  }
}

// Theme changes come from the toggle (data-theme on <html>) or the OS setting.
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

let cache: { key: string; tokens: ChartTokens } | null = null;

function snapshot(): ChartTokens {
  // Identity must stay stable between renders unless the theme actually changed.
  const key = `${document.documentElement.getAttribute("data-theme") ?? "system"}:${window.matchMedia("(prefers-color-scheme: dark)").matches}`;
  if (cache?.key !== key) cache = { key, tokens: resolveChartTokens() };
  return cache.tokens;
}

/** Chart colours for the active theme; components re-render when the theme changes. */
export function useChartTokens(): ChartTokens {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

function subscribeMotion(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
