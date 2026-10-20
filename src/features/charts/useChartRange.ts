"use client";

import type { HighchartsReactRefObject } from "@highcharts/react/Stock";
// The same Highcharts instance @highcharts/react/Stock renders with.
import Highcharts from "highcharts/es-modules/masters/highstock.src.js";
import { useCallback, useEffect, useState, type RefObject } from "react";
import {
  createGestureSession,
  panSpan,
  wheelPixels,
  wheelZoomFactor,
  widthOfPoints,
  zoomSpan,
  type Span,
} from "./range-gestures";

/** Pointer travel before a press becomes a drag, so a click stays a click. */
const DRAG_THRESHOLD_PX = 3;
/** A zoom stops at about this many data points, whatever the frequency. */
const MIN_ZOOM_POINTS = 8;

export interface ChartRange {
  /** True while this chart shows its own zoom or pan instead of the page's range. */
  readonly zoomed: boolean;
  /** Brings the chart back to the page's range. */
  readonly reset: () => void;
}

/**
 * A chart's visible range: the page's (set by the navigator and the presets
 * for every panel), unless the user zoomed or panned this chart. Pointer
 * gestures stay in the chart they happen in; the next page range brings
 * every chart back to it.
 *
 * Mouse: drag to pan; Ctrl or ⌘ + wheel zooms around the pointer, and so
 * does a trackpad pinch (browsers report it as Ctrl + wheel); a sideways
 * swipe pans. A plain wheel is left alone, so it scrolls the page, and so is
 * touch: a finger on a chart scrolls the page too.
 */
export function useChartRange(ref: RefObject<HighchartsReactRefObject | null>, range: Span | undefined): ChartRange {
  const [zoomed, setZoomed] = useState(false);
  const rangeMin = range?.min;
  const rangeMax = range?.max;

  // The page's range wins whenever it changes: re-apply it. Updating the axis
  // options alone isn't enough, because Highcharts keeps a range the chart was
  // zoomed to (user extremes) over the options.
  useEffect(() => {
    const axis = ref.current?.chart?.xAxis[0];
    if (!axis || rangeMin === undefined || rangeMax === undefined) return;
    axis.setExtremes(rangeMin, rangeMax, true, false);
  }, [ref, rangeMin, rangeMax]);

  const reset = useCallback(() => {
    const axis = ref.current?.chart?.xAxis[0];
    if (axis && rangeMin !== undefined && rangeMax !== undefined) axis.setExtremes(rangeMin, rangeMax, true, false);
    setZoomed(false);
  }, [ref, rangeMin, rangeMax]);

  useEffect(() => {
    const chart = ref.current?.chart;
    const axis = chart?.xAxis[0];
    if (!chart || !axis) return;
    const element = chart.container;

    // Any range change that isn't this chart's own gesture (the page's range,
    // the navigator's live preview, a reset) means the chart is back in step.
    let ownGesture = false;
    const removeExtremesListener = Highcharts.addEvent(axis, "afterSetExtremes", () => setZoomed(ownGesture));

    const session = createGestureSession(
      (span) => {
        // The tooltip would mark a date at its old position; it returns on the next pointer move.
        chart.pointer?.reset(false, 0);
        ownGesture = true;
        try {
          axis.setExtremes(span.min, span.max, true, false);
        } finally {
          ownGesture = false;
        }
      },
      (span) => span,
    );

    /** What the chart shows now, everything it could show, and the narrowest zoom. */
    const view = () => {
      const { min, max, dataMin, dataMax } = axis.getExtremes();
      const extent = { min: dataMin, max: dataMax };
      const points = Math.max(
        0,
        ...chart.series.map((s) => (s.options as { data?: readonly unknown[] }).data?.length ?? 0),
      );
      return { shown: { min, max }, extent, minWidth: widthOfPoints(extent, points, MIN_ZOOM_POINTS) };
    };

    /** The pointer in chart pixels, and whether it is over the plot. */
    const locate = (event: MouseEvent) => {
      const box = element.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const inside =
        x >= chart.plotLeft &&
        x <= chart.plotLeft + chart.plotWidth &&
        y >= chart.plotTop &&
        y <= chart.plotTop + chart.plotHeight;
      return { x, inside };
    };

    const onWheel = (event: WheelEvent) => {
      const dx = wheelPixels(event.deltaX, event.deltaMode);
      const dy = wheelPixels(event.deltaY, event.deltaMode);
      const zoom = event.ctrlKey || event.metaKey;
      if (!zoom && Math.abs(dx) <= Math.abs(dy)) return; // A plain wheel scrolls the page.
      const { x, inside } = locate(event);
      if (!inside) return;
      event.preventDefault();
      const { shown, extent, minWidth } = view();
      const span = session.current(shown);
      session.move(
        zoom
          ? zoomSpan(span, extent, wheelZoomFactor(dy), axis.toValue(x), minWidth)
          : panSpan(span, extent, (dx * (span.max - span.min)) / chart.plotWidth),
      );
      session.endSoon();
    };

    let drag: { id: number; x: number; span: Span; extent: Span; moved: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || !locate(event).inside) return;
      const { shown, extent } = view();
      drag = { id: event.pointerId, x: event.clientX, span: session.current(shown), extent, moved: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (!drag) {
        element.style.cursor = locate(event).inside ? "grab" : "";
        return;
      }
      const dx = event.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      if (!drag.moved) {
        drag.moved = true;
        element.setPointerCapture(drag.id);
        element.style.cursor = "grabbing";
      }
      const width = drag.span.max - drag.span.min;
      session.move(panSpan(drag.span, drag.extent, (-dx * width) / chart.plotWidth));
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const { moved } = drag;
      drag = null;
      if (!moved) return;
      element.style.cursor = "grab";
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      session.end();
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    return () => {
      removeExtremesListener();
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.style.cursor = "";
      session.cancel();
    };
  }, [ref]);

  return { zoomed, reset };
}
