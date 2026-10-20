"use client";

import type { HighchartsReactRefObject } from "@highcharts/react/Stock";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { Span } from "./range-gestures";

type Chart = HighchartsReactRefObject["chart"];

export interface ChartSync {
  /** Adds a chart to the group; returns the function that removes it. */
  register(chart: Chart): () => void;
  /** The pointer is at `x` in `source` (null: it left); with "Link hover" on, mark it in the other charts. */
  hover(source: Chart, x: number | null): void;
  /**
   * Shows `range` in every chart while the navigator's wheel zoom is under
   * way. The page's range is committed once, when the gesture ends:
   * redrawing the charts directly is cheap, re-rendering every panel on each
   * frame isn't.
   */
  preview(range: Span): void;
}

const ChartSyncContext = createContext<ChartSync | null>(null);

/**
 * Draws (or hides) a chart's x-crosshair at the point nearest `x`. Hover is a
 * transient visual, so it is applied imperatively to Highcharts rather than
 * through React state, which would re-render every panel on every pointer move.
 */
export function showCrosshairAt(chart: Chart, x: number | null): void {
  const axis = chart.xAxis?.[0];
  if (!axis) return;
  if (x === null) {
    axis.hideCrosshair();
    return;
  }
  const points = chart.series?.find((s) => s.visible && s.points?.length)?.points;
  const { min, max } = axis.getExtremes();
  if (!points?.length || x < min || x > max) {
    axis.hideCrosshair();
    return;
  }
  // Points are in x order: binary search for the nearest.
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((points[mid]?.x ?? 0) < x) lo = mid + 1;
    else hi = mid;
  }
  const before = points[lo - 1];
  const at = points[lo];
  const nearest = before && at && x - before.x < at.x - x ? before : at;
  if (nearest) axis.drawCrosshair(undefined, nearest);
}

/**
 * Groups the charts of one page so the navigator can move them all at once,
 * and, with `linkHover` on, so hovering a date in one marks it in all.
 * Zoom and pan always stay in the chart they happen in.
 */
export function ChartSyncProvider({ children, linkHover = false }: { children: ReactNode; linkHover?: boolean }) {
  const charts = useRef(new Set<Chart>());
  // Read when the pointer moves, so the group itself never changes.
  const linked = useRef(linkHover);
  useEffect(() => {
    linked.current = linkHover;
    // Turned off: clear any date still marked in other charts.
    if (!linkHover) for (const chart of charts.current) showCrosshairAt(chart, null);
  }, [linkHover]);

  const sync = useMemo<ChartSync>(
    () => ({
      register(chart) {
        charts.current.add(chart);
        return () => {
          charts.current.delete(chart);
        };
      },
      hover(source, x) {
        if (!linked.current) return;
        for (const chart of charts.current) if (chart !== source) showCrosshairAt(chart, x);
      },
      preview(range) {
        for (const chart of charts.current) {
          // A tooltip would mark a date at its old position; clear it while the range moves.
          chart.pointer?.reset(false, 0);
          chart.xAxis?.[0]?.setExtremes(range.min, range.max, true, false);
        }
      },
    }),
    [],
  );
  return <ChartSyncContext value={sync}>{children}</ChartSyncContext>;
}

/** The page's chart group, or null outside a ChartSyncProvider. */
export function useChartSync(): ChartSync | null {
  return useContext(ChartSyncContext);
}
