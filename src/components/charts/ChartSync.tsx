"use client";

import type { HighchartsReactRefObject } from "@highcharts/react/Stock";
import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import type { Span } from "@/lib/range-gestures";

type Chart = HighchartsReactRefObject["chart"];

export interface ChartSync {
  /** Adds a chart to the group; returns the function that removes it. */
  register(chart: Chart): () => void;
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
 * Groups the charts of one page so the navigator can move them all at once.
 * Pointer actions on a chart (hover, pan, zoom) stay in that chart.
 */
export function ChartSyncProvider({ children }: { children: ReactNode }) {
  const charts = useRef(new Set<Chart>());
  const sync = useMemo<ChartSync>(
    () => ({
      register(chart) {
        charts.current.add(chart);
        return () => {
          charts.current.delete(chart);
        };
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
