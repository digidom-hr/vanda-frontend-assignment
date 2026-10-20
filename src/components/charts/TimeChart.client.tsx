"use client";

import { StockChart, type HighchartsReactRefObject } from "@highcharts/react/Stock";
// Side-effect import: registers keyboard navigation and screen-reader support.
import "highcharts/es-modules/masters/modules/accessibility.src.js";
import { useEffect, useMemo, useRef } from "react";
import { buildChartOptions } from "./chart-options";
import { useChartSync } from "./ChartSync";
import { useChartTokens, useReducedMotion } from "./chart-tokens";
import type { TimeChartProps } from "./TimeChart";
import styles from "./TimeChart.module.css";

/** The Highcharts-backed chart. Loaded lazily and only in the browser; use `TimeChart`. */
export default function TimeChartClient({ spec }: TimeChartProps) {
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const ref = useRef<HighchartsReactRefObject>(null);
  const sync = useChartSync();

  // Join the page's chart group, so hovering here marks the same date in the other panels.
  useEffect(() => {
    const chart = ref.current?.chart;
    return sync && chart ? sync.register(chart) : undefined;
  }, [sync]);

  // Highcharts passes the chart the pointer is in, so no ref is read here.
  const options = useMemo(
    () =>
      buildChartOptions(spec, tokens, {
        reducedMotion,
        onHover: sync ? (x, chart) => sync.hover(chart, x) : undefined,
      }),
    [spec, tokens, reducedMotion, sync],
  );
  // The page's range always wins: re-apply it whenever it changes. Updating
  // the axis options alone isn't enough, because Highcharts keeps a range the
  // chart itself zoomed to (user extremes) over the options.
  const rangeMin = spec.range?.min;
  const rangeMax = spec.range?.max;
  useEffect(() => {
    const axis = ref.current?.chart?.xAxis[0];
    if (!axis || rangeMin === undefined || rangeMax === undefined) return;
    axis.setExtremes(rangeMin, rangeMax, true, false);
  }, [rangeMin, rangeMax]);

  return <StockChart ref={ref} options={options} containerProps={{ className: styles.container }} />;
}
