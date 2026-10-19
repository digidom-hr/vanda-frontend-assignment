/**
 * Window arithmetic for the time rail, in data-point indices so the window
 * always snaps to real timestamps (trading days, not calendar days).
 */

/** Index of the timestamp closest to `x` (t is ascending). */
export function nearestIndex(t: readonly number[], x: number): number {
  if (t.length === 0) return -1;
  let lo = 0;
  let hi = t.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((t[mid] as number) < x) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && x - (t[lo - 1] as number) < (t[lo] as number) - x) return lo - 1;
  return lo;
}

const DAY_MS = 86_400_000;

/**
 * The points a time range covers: from the first point on or after the start
 * of `min`'s UTC day, to the last point at or before `max`. (Nearest-point
 * rounding would push an end-of-day boundary onto the next day.)
 */
export function windowForRange(t: readonly number[], min: number, max: number): IndexWindow {
  const dayStart = Math.floor(min / DAY_MS) * DAY_MS;
  let start = t.findIndex((x) => x >= dayStart);
  if (start === -1) start = Math.max(0, t.length - 1);
  let end = t.length - 1;
  while (end > start && (t[end] as number) > max) end--;
  return { start, end };
}

export interface IndexWindow {
  readonly start: number;
  readonly end: number;
}

/** The smallest window the rail allows, in points. */
export const MIN_WINDOW_POINTS = 2;

/** Moves the window by `delta` points, keeping its size and staying inside 0..last. */
export function moveWindow(w: IndexWindow, delta: number, last: number): IndexWindow {
  const size = w.end - w.start;
  const start = Math.min(Math.max(0, w.start + delta), Math.max(0, last - size));
  return { start, end: start + size };
}

/** Moves one edge to `index`, keeping at least MIN_WINDOW_POINTS between the edges. */
export function resizeWindow(w: IndexWindow, edge: "start" | "end", index: number, last: number): IndexWindow {
  const gap = MIN_WINDOW_POINTS - 1;
  if (edge === "start") return { start: Math.min(Math.max(0, index), w.end - gap), end: w.end };
  return { start: w.start, end: Math.max(Math.min(last, index), w.start + gap) };
}

/** Centres a window of the same size on `index`. */
export function centreWindow(w: IndexWindow, index: number, last: number): IndexWindow {
  const size = w.end - w.start;
  return moveWindow(w, index - Math.round(size / 2) - w.start, last);
}
