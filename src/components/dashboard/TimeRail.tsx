"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Skeleton } from "@/components/feedback/Skeleton";
import { formatTimestamp } from "@/lib/format";
import { centreWindow, moveWindow, nearestIndex, resizeWindow, windowForRange, type IndexWindow } from "@/lib/rail";
import styles from "./TimeRail.module.css";

export interface TimeRailProps {
  /** Overview data: the primary series over its full history. */
  readonly t: readonly number[];
  readonly values: readonly (number | null)[];
  /** The visible range in epoch ms. */
  readonly range: { readonly min: number; readonly max: number };
  /** Called when the user settles on a new range (release, or each key press). */
  readonly onCommit: (range: { min: number; max: number }) => void;
  readonly label?: string;
}

const HEIGHT = 56;
const DAY_MS = 86_400_000;

type Drag = { mode: "move" | "start" | "end"; originIndex: number; originWindow: IndexWindow };

/** SVG path of the overview line, scaled to the rail. */
function overviewPath(t: readonly number[], values: readonly (number | null)[], width: number): string {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v === null) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo) || t.length < 2) return "";
  const span = hi - lo || 1;
  const t0 = t[0] as number;
  const tSpan = (t[t.length - 1] as number) - t0 || 1;
  let d = "";
  let pen = false;
  for (let i = 0; i < t.length; i++) {
    const v = values[i];
    if (v === null || v === undefined) {
      pen = false;
      continue;
    }
    const x = (((t[i] as number) - t0) / tSpan) * width;
    const y = HEIGHT - 6 - ((v - lo) / span) * (HEIGHT - 16);
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

/**
 * The page's time rail: the primary series' whole history with a highlighter
 * window marking the visible range. Drag the window to pan, its edges to
 * resize, or click elsewhere to move it there. Keyboard: three sliders (the
 * period, its start, its end) with arrow keys, Shift+arrows, Home and End.
 * The rail follows the pointer live; panels update when the drag ends.
 */
export function TimeRail({ t, values, range, onCommit, label = "Time range" }: TimeRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [draft, setDraft] = useState<IndexWindow | null>(null);
  const drag = useRef<Drag | null>(null);
  const last = t.length - 1;

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const committed = useMemo(() => windowForRange(t, range.min, range.max), [t, range.min, range.max]);
  const shown = draft ?? committed;
  const path = useMemo(() => overviewPath(t, values, width), [t, values, width]);

  const t0 = t[0] ?? 0;
  const tSpan = (t[last] ?? 0) - t0 || 1;
  const pct = (i: number) => (((t[i] ?? t0) - t0) / tSpan) * 100;

  // About a month of points: the large keyboard step at any frequency.
  const bigStep = Math.max(5, Math.round((30 * DAY_MS * last) / tSpan));

  const years = useMemo(() => {
    const marks: { index: number; year: number }[] = [];
    for (let i = 1; i < t.length; i++) {
      const y = new Date(t[i] as number).getUTCFullYear();
      if (y !== new Date(t[i - 1] as number).getUTCFullYear()) marks.push({ index: i, year: y });
    }
    return marks;
  }, [t]);

  const commit = (w: IndexWindow) => onCommit({ min: t[w.start] as number, max: t[w.end] as number });

  const indexAt = (clientX: number) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const x = t0 + ((clientX - rect.left) / rect.width) * tSpan;
    return nearestIndex(t, x);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || last < 1) return;
    const target = event.target as HTMLElement;
    const mode = (target.dataset.mode as Drag["mode"] | undefined) ?? "move";
    const index = indexAt(event.clientX);
    let origin = shown;
    // A press outside the window first moves the window there.
    if (!target.dataset.mode && (index < shown.start || index > shown.end)) {
      origin = centreWindow(shown, index, last);
      setDraft(origin);
    }
    drag.current = { mode, originIndex: index, originWindow: origin };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const index = indexAt(event.clientX);
    setDraft(
      d.mode === "move"
        ? moveWindow(d.originWindow, index - d.originIndex, last)
        : resizeWindow(d.originWindow, d.mode, index, last),
    );
  };

  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    if (draft) commit(draft);
    setDraft(null);
  };

  const keyHandler = (mode: Drag["mode"]) => (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? bigStep : 1;
    const delta: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -bigStep,
      PageUp: bigStep,
    };
    let next: IndexWindow | null = null;
    if (event.key in delta) {
      const d = delta[event.key] as number;
      next =
        mode === "move"
          ? moveWindow(committed, d, last)
          : resizeWindow(committed, mode, (mode === "start" ? committed.start : committed.end) + d, last);
    } else if (event.key === "Home" || event.key === "End") {
      const toEnd = event.key === "End";
      next = {
        move: moveWindow(committed, toEnd ? last : -last, last),
        start: resizeWindow(committed, "start", toEnd ? committed.end : 0, last),
        end: resizeWindow(committed, "end", toEnd ? last : committed.start, last),
      }[mode];
    }
    if (next) {
      event.preventDefault();
      commit(next);
    }
  };

  const date = (i: number) => formatTimestamp(t[i] ?? t0);
  const periodText = `${date(shown.start)} to ${date(shown.end)}`;
  const points = shown.end - shown.start + 1;

  if (t.length < 2) return null;

  return (
    <div className={styles.wrap} role="group" aria-label={label}>
      <div
        ref={railRef}
        className={styles.rail}
        style={{ height: HEIGHT }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        data-dragging={draft ? "" : undefined}
      >
        <svg className={styles.svg} width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
          {years.map(({ index, year }) => (
            <g key={year}>
              <line x1={`${pct(index)}%`} x2={`${pct(index)}%`} y1={0} y2={HEIGHT} className={styles.yearLine} />
              <text x={`${pct(index)}%`} dx={4} y={12} className={styles.yearLabel}>
                {year}
              </text>
            </g>
          ))}
          {path && <path d={`${path}L${width},${HEIGHT}L0,${HEIGHT}Z`} className={styles.area} />}
          {path && <path d={path} className={styles.line} />}
        </svg>

        {/* Window and handles are siblings: interactive controls must not be nested (WCAG). */}
        <div
          className={styles.window}
          style={{ left: `${pct(shown.start)}%`, width: `${Math.max(0.4, pct(shown.end) - pct(shown.start))}%` }}
          data-mode="move"
          role="slider"
          tabIndex={0}
          aria-label="Selected period"
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={shown.start}
          aria-valuetext={periodText}
          onKeyDown={keyHandler("move")}
        />
        <div
          className={styles.handle}
          style={{ left: `${pct(shown.start)}%` }}
          data-mode="start"
          role="slider"
          tabIndex={0}
          aria-label="Start of period"
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={shown.start}
          aria-valuetext={date(shown.start)}
          onKeyDown={keyHandler("start")}
        />
        <div
          className={styles.handle}
          style={{ left: `${pct(shown.end)}%` }}
          data-mode="end"
          role="slider"
          tabIndex={0}
          aria-label="End of period"
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={shown.end}
          aria-valuetext={date(shown.end)}
          onKeyDown={keyHandler("end")}
        />
      </div>
      <p className={styles.caption} aria-live="polite">
        {periodText}, {points.toLocaleString("en-US")} data points
      </p>
    </div>
  );
}

/** The rail's shape while its overview loads, at the same height so nothing shifts. */
export function TimeRailSkeleton() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <Skeleton height={HEIGHT} />
      <span className={styles.caption}>
        <Skeleton tone="text" width="15rem" />
      </span>
    </div>
  );
}
