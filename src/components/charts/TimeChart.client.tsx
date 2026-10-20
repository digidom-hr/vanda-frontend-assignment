"use client";

import { StockChart, type HighchartsReactRefObject } from "@highcharts/react/Stock";
// Side-effect import: registers keyboard navigation and screen-reader support.
import "highcharts/es-modules/masters/modules/accessibility.src.js";
import { useEffect, useMemo, useRef } from "react";
import { Icon } from "@/components/icons/Icon";
import { buildChartOptions } from "./chart-options";
import { useChartSync } from "./ChartSync";
import { useChartTokens, useReducedMotion } from "./chart-tokens";
import type { TimeChartProps } from "./TimeChart";
import styles from "./TimeChart.module.css";
import { useChartRange } from "./useChartRange";

/** The Highcharts-backed chart. Loaded lazily and only in the browser; use `TimeChart`. */
export default function TimeChartClient({ spec }: TimeChartProps) {
  const tokens = useChartTokens();
  const reducedMotion = useReducedMotion();
  const ref = useRef<HighchartsReactRefObject>(null);
  const sync = useChartSync();

  // Join the page's chart group, so the navigator can move every chart at once.
  useEffect(() => {
    const chart = ref.current?.chart;
    return sync && chart ? sync.register(chart) : undefined;
  }, [sync]);

  const options = useMemo(() => buildChartOptions(spec, tokens, { reducedMotion }), [spec, tokens, reducedMotion]);

  // The page's range, unless this chart was zoomed or panned on its own.
  const { zoomed, reset } = useChartRange(ref, spec.range);

  return (
    <>
      <StockChart ref={ref} options={options} containerProps={{ className: styles.container }} />
      {zoomed && (
        <button type="button" className={styles.reset} onClick={reset}>
          <Icon name="rotate-ccw" size={12} />
          Reset zoom
        </button>
      )}
    </>
  );
}
