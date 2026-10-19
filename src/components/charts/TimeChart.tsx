"use client";

import dynamic from "next/dynamic";
import type { ChartSpec } from "./chart-options";
import styles from "./TimeChart.module.css";

export interface TimeChartProps {
  readonly spec: ChartSpec;
  /** New data is loading: keep the current frame, dimmed, rather than flashing a placeholder. */
  readonly isRefreshing?: boolean;
}

// Highcharts is large and browser-only: load it in its own chunk, after the page is interactive.
const TimeChartClient = dynamic(() => import("./TimeChart.client"), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

/** A themed, accessible timeseries chart. Reserves its height so nothing shifts while Highcharts loads. */
export function TimeChart({ spec, isRefreshing }: TimeChartProps) {
  return (
    <div
      className={styles.frame}
      style={{ minHeight: spec.height }}
      data-refreshing={isRefreshing || undefined}
      aria-busy={isRefreshing || undefined}
    >
      <TimeChartClient spec={spec} />
    </div>
  );
}
