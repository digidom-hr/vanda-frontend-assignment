/**
 * Window arithmetic for the range navigator, in data-point indices, so the
 * caption and the keyboard controls work in real timestamps (trading days,
 * not calendar days).
 */

const DAY_MS = 86_400_000;

export interface IndexWindow {
  readonly start: number;
  readonly end: number;
}

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

/** The smallest window, in points. */
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

/** Which part of the window a keyboard control moves: the whole period, or one edge. */
export type WindowPart = "period" | "start" | "end";

/**
 * The window after a key press on one of the range's keyboard controls, or
 * null for keys they don't handle. Arrows move one data point; Shift+arrows
 * and Page Up/Down move `bigStep` points; Home and End go to the ends.
 */
export function windowForKey(
  w: IndexWindow,
  part: WindowPart,
  key: string,
  shiftKey: boolean,
  last: number,
  bigStep: number,
): IndexWindow | null {
  const step = shiftKey ? bigStep : 1;
  const deltas: Record<string, number> = {
    ArrowLeft: -step,
    ArrowDown: -step,
    ArrowRight: step,
    ArrowUp: step,
    PageDown: -bigStep,
    PageUp: bigStep,
  };
  const delta = deltas[key];
  if (delta !== undefined) {
    if (part === "period") return moveWindow(w, delta, last);
    return resizeWindow(w, part, (part === "start" ? w.start : w.end) + delta, last);
  }
  if (key === "Home" || key === "End") {
    const toEnd = key === "End";
    if (part === "period") return moveWindow(w, toEnd ? last : -last, last);
    if (part === "start") return resizeWindow(w, "start", toEnd ? w.end : 0, last);
    return resizeWindow(w, "end", toEnd ? last : w.start, last);
  }
  return null;
}
