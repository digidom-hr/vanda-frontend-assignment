"use client";

import dynamic from "next/dynamic";
import type { ChartSpec } from "./chart-options";
import styles from "./TimeChart.module.css";

export interface TimeChartProps {
  readonly spec: ChartSpec;
}

const loadTimeChart = () => import("./TimeChart.client");

/**
 * Starts downloading the chart code early (it is cached after the first
 * call). Called when a dashboard mounts, so the chunk loads in parallel with
 * the data instead of after it, and on intent (hovering a service link).
 */
export function preloadTimeChart(): void {
  void loadTimeChart();
}

// Highcharts is large and browser-only: load it in its own chunk, after the page is interactive.
const TimeChartClient = dynamic(loadTimeChart, {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

/** A themed, accessible timeseries chart. Reserves its height so nothing shifts while Highcharts loads. */
export function TimeChart({ spec }: TimeChartProps) {
  return (
    <div className={styles.frame} style={{ minHeight: spec.height }}>
      <TimeChartClient spec={spec} />
    </div>
  );
}
