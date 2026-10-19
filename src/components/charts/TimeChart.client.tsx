"use client";

import { StockChart } from "@highcharts/react/Stock";
// Side-effect import: registers keyboard navigation and screen-reader support.
import "highcharts/es-modules/masters/modules/accessibility.src.js";
import { useMemo } from "react";
import { buildChartOptions } from "./chart-options";
import { useChartTokens, useReducedMotion } from "./chart-tokens";
import type { TimeChartProps } from "./TimeChart";
import styles from "./TimeChart.module.css";

/** The Highcharts-backed chart. Loaded lazily and only in the browser; use `TimeChart`. */
export default function TimeChartClient({ spec }: TimeChartProps) {
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const options = useMemo(() => buildChartOptions(spec, tokens, { reducedMotion }), [spec, tokens, reducedMotion]);
  return <StockChart options={options} containerProps={{ className: styles.container }} />;
}
