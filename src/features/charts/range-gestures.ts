/** A time range in epoch ms. */
export interface Span {
  readonly min: number;
  readonly max: number;
}

/**
 * The range after zooming by `factor` (below 1 zooms in, above 1 out) around
 * `anchor`: the time under the pointer stays under the pointer. An anchor
 * outside the range counts as its nearest end. The result is at least
 * `minWidth` wide, at most the whole history, and stays inside it.
 */
export function zoomSpan(span: Span, extent: Span, factor: number, anchor: number, minWidth: number): Span {
  const width = span.max - span.min;
  const full = extent.max - extent.min;
  const next = Math.min(full, Math.max(Math.min(minWidth, full), width * factor));
  const at = Math.min(span.max, Math.max(span.min, anchor));
  const ratio = width > 0 ? (at - span.min) / width : 0.5;
  const min = at - ratio * next;
  return shiftInto({ min, max: min + next }, extent);
}

/** The range moved by `delta` ms, keeping its width and stopping at the ends of the history. */
export function panSpan(span: Span, extent: Span, delta: number): Span {
  return shiftInto({ min: span.min + delta, max: span.max + delta }, extent);
}

function shiftInto(span: Span, extent: Span): Span {
  const width = Math.min(span.max - span.min, extent.max - extent.min);
  if (span.min < extent.min) return { min: extent.min, max: extent.min + width };
  if (span.max > extent.max) return { min: extent.max - width, max: extent.max };
  return { min: span.min, max: span.min + width };
}

/** The time `count` data points take on average, over `extent` holding `points` points: a zoom limit that suits any frequency. */
export function widthOfPoints(extent: Span, points: number, count: number): number {
  const full = extent.max - extent.min;
  return points > 1 ? Math.min(full, (full / (points - 1)) * count) : full;
}

/**
 * Wheel distance (pixels) to a zoom factor. One mouse-wheel notch (~100) is
 * about 30%; trackpad scrolls and pinches arrive as many small steps that add up.
 */
export function wheelZoomFactor(deltaY: number): number {
  return Math.pow(2, deltaY / 250);
}

/** Wheel deltas in pixels, whatever unit the browser reported them in. */
export function wheelPixels(delta: number, deltaMode: number): number {
  // 1: lines (Firefox with a mouse), 2: pages.
  return deltaMode === 1 ? delta * 40 : deltaMode === 2 ? delta * 800 : delta;
}

/**
 * One zoom or pan gesture, from its first wheel step or pointer move until it
 * settles. Each step builds on the range the gesture has reached, not on the
 * page's range, which is rounded to whole days: small trackpad steps add up
 * instead of being rounded away. The range is shown at most once a frame and
 * committed once, at the end.
 */
export interface GestureSession {
  /** The range the gesture has reached, or `fallback` (the page's range) before it starts. */
  current(fallback: Span): Span;
  /** Moves the gesture to `span` and shows it on the next frame. */
  move(span: Span): void;
  /** Ends the gesture after `settleMs` without a new step (wheel and pinch have no "end" event). */
  endSoon(): void;
  /** Ends the gesture now: commits its range and shows the range the page settles on. */
  end(): void;
  /** Drops the gesture without committing (unmount). */
  cancel(): void;
}

export function createGestureSession(
  show: (span: Span) => void,
  commit: (span: Span) => Span,
  settleMs = 250,
): GestureSession {
  let pending: Span | null = null;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    clearTimeout(timer);
  };
  const session: GestureSession = {
    current: (fallback) => pending ?? fallback,
    move(span) {
      pending = span;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pending) show(pending);
      });
    },
    endSoon() {
      clearTimeout(timer);
      timer = setTimeout(session.end, settleMs);
    },
    end() {
      stop();
      if (!pending) return;
      const reached = pending;
      pending = null;
      show(commit(reached));
    },
    cancel() {
      stop();
      pending = null;
    },
  };
  return session;
}
