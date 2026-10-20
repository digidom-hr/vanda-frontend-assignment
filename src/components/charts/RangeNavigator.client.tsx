"use client";

import Highcharts from "highcharts/es-modules/masters/highstock.src.js";
// Side-effect import: registers the standalone navigator.
import "highcharts/es-modules/masters/modules/navigator.src.js";
import { useEffect, useMemo, useRef } from "react";
import { useChartTokens } from "./chart-tokens";
import { buildNavigatorOptions } from "./navigator-options";
import type { NavigatorPlot, RangeNavigatorProps } from "./RangeNavigator";
import styles from "./RangeNavigator.module.css";

/**
 * The part of Highcharts' StandaloneNavigator this component uses. (Its
 * published typings declare `Highcharts.navigator()` as returning void.)
 */
interface StandaloneNavigator {
  /** The inner navigator: fires `setRange` when the user settles on a range. */
  readonly navigator: {
    /** The navigator's time axis: converts a time to a pixel position in the chart. */
    readonly xAxis: { toPixels(value: number): number };
    readonly chart: object;
  };
  setRange(min: number, max: number, redraw?: boolean, animation?: boolean): void;
  getRange(): { min: number; max: number };
  destroy(): void;
}

interface SetRangeEvent {
  readonly min: number;
  readonly max: number;
}

const createNavigator = Highcharts.navigator as unknown as (
  element: HTMLElement,
  options: ReturnType<typeof buildNavigatorOptions>,
) => StandaloneNavigator;

export interface RangeNavigatorClientProps extends RangeNavigatorProps {
  /** Reports where Highcharts draws the plot, after every render, so controls can align with it. */
  readonly onLayout: (plot: NavigatorPlot) => void;
}

/** Highcharts' standalone navigator, kept in step with the page's range. Use `RangeNavigator`. */
export default function RangeNavigatorClient({ t, values, range, onCommit, onLayout }: RangeNavigatorClientProps) {
  const tokens = useChartTokens();
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<StandaloneNavigator | null>(null);
  // True while this component moves the navigator itself, so that move isn't reported back as a user choice.
  const syncing = useRef(false);
  const lastCommit = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  const onLayoutRef = useRef(onLayout);
  useEffect(() => {
    onCommitRef.current = onCommit;
    onLayoutRef.current = onLayout;
  }, [onCommit, onLayout]);

  const options = useMemo(() => buildNavigatorOptions({ t, values }, tokens), [t, values, tokens]);

  // (Re)create the navigator when its data or theme changes.
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const nav = createNavigator(element, options);
    instance.current = nav;
    // Highcharts pads the plot by amounts that depend on the width, so ask its
    // axis where the first and last data points are drawn.
    const first = t[0] ?? 0;
    const last = t[t.length - 1] ?? first;
    const reportLayout = () => {
      const left = nav.navigator.xAxis.toPixels(first);
      onLayoutRef.current({ left, width: nav.navigator.xAxis.toPixels(last) - left });
    };
    const removeRenderListener = Highcharts.addEvent(nav.navigator.chart, "render", reportLayout);
    reportLayout();
    const removeListener = Highcharts.addEvent(nav.navigator, "setRange", (event: SetRangeEvent) => {
      if (syncing.current) return;
      const key = `${event.min}:${event.max}`;
      if (key === lastCommit.current) return;
      lastCommit.current = key;
      onCommitRef.current({ min: event.min, max: event.max });
    });
    return () => {
      removeRenderListener();
      removeListener();
      nav.destroy();
      instance.current = null;
    };
  }, [options, t]);

  // Follow the page's range (presets, links, Back/Forward).
  useEffect(() => {
    const nav = instance.current;
    if (!nav) return;
    const current = nav.getRange();
    if (current.min === range.min && current.max === range.max) return;
    syncing.current = true;
    try {
      nav.setRange(range.min, range.max, true, false);
    } finally {
      syncing.current = false;
    }
  }, [options, range.min, range.max]);

  // Drawing and pointer only: RangeNavigator puts the keyboard and screen-reader
  // controls on top. The hidden wrapper is separate from the element Highcharts
  // renders into, because Highcharts sets its own role on that element.
  return (
    <div className={styles.container} aria-hidden="true">
      <div ref={container} className={styles.container} />
    </div>
  );
}
