"use client";

import Highcharts from "highcharts/es-modules/masters/highstock.src.js";
// Side-effect import: registers the standalone navigator.
import "highcharts/es-modules/masters/modules/navigator.src.js";
import { useEffect, useMemo, useRef } from "react";
import { createGestureSession, panSpan, wheelPixels, wheelZoomFactor, zoomSpan, type Span } from "./range-gestures";
import { useChartSync } from "./ChartSync";
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
    /** The navigator's time axis: converts between times and pixel positions in the chart. */
    readonly xAxis: { toPixels(value: number): number; toValue(pixel: number): number; readonly len: number };
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

/** A wheel this soon after the page scrolled continues the scroll instead of zooming (ms). */
const SCROLL_CARRY_MS = 200;

/** Highcharts' standalone navigator, kept in step with the page's range. Use `RangeNavigator`. */
export default function RangeNavigatorClient({
  t,
  values,
  range,
  minWidth,
  onCommit,
  onLayout,
}: RangeNavigatorClientProps) {
  const tokens = useChartTokens();
  const sync = useChartSync();
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<StandaloneNavigator | null>(null);
  // True while this component moves the navigator itself, so that move isn't reported back as a user choice.
  const syncing = useRef(false);
  const lastCommit = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  const onLayoutRef = useRef(onLayout);
  const rangeRef = useRef(range);
  const minWidthRef = useRef(minWidth);
  useEffect(() => {
    onCommitRef.current = onCommit;
    onLayoutRef.current = onLayout;
    rangeRef.current = range;
    minWidthRef.current = minWidth;
  }, [onCommit, onLayout, range, minWidth]);

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
    // Shows a range without reporting it back as the user's choice.
    const move = (span: Span) => {
      const current = nav.getRange();
      if (current.min === span.min && current.max === span.max) return;
      syncing.current = true;
      try {
        nav.setRange(span.min, span.max, true, false);
      } finally {
        syncing.current = false;
      }
    };
    // The page rounds a range to whole days; show what it settled on, even
    // when that is the range it already had (so no re-render would move us).
    let settleFrame = 0;
    const commit = (span: Span) => {
      const shown = onCommitRef.current(span);
      cancelAnimationFrame(settleFrame);
      settleFrame = requestAnimationFrame(() => move(shown));
      return shown;
    };
    const removeListener = Highcharts.addEvent(nav.navigator, "setRange", (event: SetRangeEvent) => {
      if (syncing.current) return;
      const key = `${event.min}:${event.max}`;
      if (key === lastCommit.current) return;
      lastCommit.current = key;
      commit({ min: event.min, max: event.max });
    });

    // The wheel zooms the period around the pointer; Shift + wheel or a
    // sideways swipe moves it. The charts follow live, the page when it settles.
    const history = { min: first, max: last };
    const session = createGestureSession((span) => {
      move(span);
      sync?.preview(span);
    }, commit);
    let lastPageScroll = -Infinity;
    const onScroll = () => {
      lastPageScroll = performance.now();
    };
    const onWheel = (event: WheelEvent) => {
      // Scrolling the page past the strip carries on scrolling the page.
      if (performance.now() - lastPageScroll < SCROLL_CARRY_MS) return;
      event.preventDefault();
      const dx = wheelPixels(event.deltaX, event.deltaMode);
      const dy = wheelPixels(event.deltaY, event.deltaMode);
      const sideways = Math.abs(dx) > Math.abs(dy) ? dx : event.shiftKey ? dy : 0;
      const span = session.current(rangeRef.current);
      const axis = nav.navigator.xAxis;
      if (sideways !== 0) {
        // One navigator width of scrolling moves the period by its own width.
        session.move(panSpan(span, history, (sideways * (span.max - span.min)) / axis.len));
      } else {
        const x = event.clientX - element.getBoundingClientRect().left;
        session.move(zoomSpan(span, history, wheelZoomFactor(dy), axis.toValue(x), minWidthRef.current));
      }
      session.endSoon();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("scroll", onScroll);
      element.removeEventListener("wheel", onWheel);
      session.cancel();
      cancelAnimationFrame(settleFrame);
      removeRenderListener();
      removeListener();
      nav.destroy();
      instance.current = null;
    };
  }, [options, t, sync]);

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
