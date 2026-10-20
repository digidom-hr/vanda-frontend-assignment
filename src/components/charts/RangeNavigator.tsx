"use client";

import dynamic from "next/dynamic";
import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { Skeleton } from "@/components/feedback/Skeleton";
import { formatTimestamp } from "@/lib/format";
import { windowForKey, windowForRange, type IndexWindow, type WindowPart } from "@/lib/rail";
import { NAVIGATOR_HEIGHT, NAVIGATOR_TOTAL_HEIGHT } from "./navigator-options";
import styles from "./RangeNavigator.module.css";

export interface RangeNavigatorProps {
  /** Overview data: the primary series over its full history. */
  readonly t: readonly number[];
  readonly values: readonly (number | null)[];
  /** The visible range in epoch ms. */
  readonly range: { readonly min: number; readonly max: number };
  /** Called when the user settles on a new range (end of a drag, or a key press). */
  readonly onCommit: (range: { min: number; max: number }) => void;
  readonly label: string;
}

/** Where Highcharts draws the first and last data points inside its container, in pixels. */
export interface NavigatorPlot {
  readonly left: number;
  readonly width: number;
}

const DAY_MS = 86_400_000;

const loadRangeNavigator = () => import("./RangeNavigator.client");

/** Starts downloading the navigator code early, in parallel with the data. */
export function preloadRangeNavigator(): void {
  void loadRangeNavigator();
}

const RangeNavigatorClient = dynamic(loadRangeNavigator, {
  ssr: false,
  loading: () => <Skeleton height={NAVIGATOR_TOTAL_HEIGHT} />,
});

/**
 * The page's range control, under the primary chart: Highcharts' navigator
 * over the primary series' whole history, with the visible period
 * highlighted. Every panel follows when a drag ends.
 *
 * Highcharts draws it and handles the pointer. Keyboard and screen readers
 * use three sliders laid over it (the period, its start, its end) that move
 * by data points and speak dates. The caption states the period and is
 * announced when it changes.
 */
export function RangeNavigator(props: RangeNavigatorProps) {
  const { t, range, onCommit, label } = props;
  // Until Highcharts reports its plot, the keyboard layer spans the container.
  const [plot, setPlot] = useState<NavigatorPlot | null>(null);
  const last = t.length - 1;
  if (last < 1) return null;

  const shown = windowForRange(t, range.min, range.max);
  const points = shown.end - shown.start + 1;
  const date = (i: number) => formatTimestamp(t[i] as number);
  const periodText = `${date(shown.start)} to ${date(shown.end)}`;

  const t0 = t[0] as number;
  const tSpan = (t[last] as number) - t0 || 1;
  const at = (i: number) => ((t[i] as number) - t0) / tSpan;
  // About a month of points: the large keyboard step at any frequency.
  const bigStep = Math.max(5, Math.round((30 * DAY_MS * last) / tSpan));

  const commit = (w: IndexWindow) => onCommit({ min: t[w.start] as number, max: t[w.end] as number });
  const onKeyDown = (part: WindowPart) => (event: KeyboardEvent<HTMLDivElement>) => {
    const next = windowForKey(shown, part, event.key, event.shiftKey, last, bigStep);
    if (!next) return;
    event.preventDefault();
    commit(next);
  };

  const slider = (part: WindowPart, name: string, valueNow: number, valueText: string, style: CSSProperties) => (
    <div
      className={part === "period" ? styles.period : styles.handle}
      style={style}
      role="slider"
      tabIndex={0}
      aria-label={name}
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={valueNow}
      aria-valuetext={valueText}
      onKeyDown={onKeyDown(part)}
    />
  );

  return (
    <div className={styles.wrap} role="group" aria-label={label} data-tour="navigator">
      <div className={styles.frame} style={{ height: NAVIGATOR_TOTAL_HEIGHT }}>
        <RangeNavigatorClient {...props} onLayout={setPlot} />
        {/* Keyboard layer: invisible until focused, aligned with Highcharts' plot; the pointer passes through. */}
        <div
          className={styles.keys}
          style={{ left: plot?.left ?? 0, width: plot?.width ?? "100%", height: NAVIGATOR_HEIGHT }}
        >
          {slider("period", "Selected period", shown.start, periodText, {
            "--from": at(shown.start),
            "--to": at(shown.end),
          } as CSSProperties)}
          {slider("start", "Start of period", shown.start, date(shown.start), {
            "--at": at(shown.start),
          } as CSSProperties)}
          {slider("end", "End of period", shown.end, date(shown.end), { "--at": at(shown.end) } as CSSProperties)}
        </div>
      </div>
      <p className={styles.caption} aria-live="polite">
        {periodText}, {points.toLocaleString("en-US")} data points
      </p>
    </div>
  );
}

/** The navigator's shape while its overview loads, at the same height so nothing shifts. */
export function RangeNavigatorSkeleton() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <Skeleton height={NAVIGATOR_TOTAL_HEIGHT} />
      <span className={styles.caption}>
        <Skeleton tone="text" width="15rem" />
      </span>
    </div>
  );
}
