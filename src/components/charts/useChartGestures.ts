"use client";

import type { HighchartsReactRefObject } from "@highcharts/react/Stock";
import { useEffect, useRef, type RefObject } from "react";
import { createGestureSession, panSpan, wheelPixels, wheelZoomFactor, zoomSpan, type Span } from "@/lib/range-gestures";
import type { ChartSync } from "./ChartSync";
import { useRangeGestures } from "./RangeGestures";

/** Pointer travel before a press becomes a drag, so a click stays a click. */
const DRAG_THRESHOLD_PX = 3;

/**
 * Zooming and panning a chart moves the page's range, so every panel and the
 * navigator follow (Highcharts' own per-chart zoom and pan are off).
 *
 * Mouse: drag to pan; Ctrl or ⌘ + wheel zooms around the pointer, and so
 * does a trackpad pinch (browsers report it as Ctrl + wheel); a sideways
 * swipe pans. A plain wheel is left alone, so it scrolls the page, and so is
 * touch: a finger on a chart scrolls the page too.
 */
export function useChartGestures(ref: RefObject<HighchartsReactRefObject | null>, sync: ChartSync | null): void {
  const gestures = useRangeGestures();
  const latest = useRef(gestures);
  useEffect(() => {
    latest.current = gestures;
  }, [gestures]);
  const enabled = gestures !== null;

  useEffect(() => {
    const chart = ref.current?.chart;
    if (!enabled || !chart) return;
    const element = chart.container;
    const axis = () => chart.xAxis[0];
    const session = createGestureSession(
      (span) => {
        if (sync) sync.preview(span);
        else axis()?.setExtremes(span.min, span.max, true, false);
      },
      (span) => latest.current?.commit(span) ?? span,
    );

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
      const g = latest.current;
      if (!g) return;
      const dx = wheelPixels(event.deltaX, event.deltaMode);
      const dy = wheelPixels(event.deltaY, event.deltaMode);
      const zoom = event.ctrlKey || event.metaKey;
      if (!zoom && Math.abs(dx) <= Math.abs(dy)) return; // A plain wheel scrolls the page.
      const { x, inside } = locate(event);
      if (!inside) return;
      event.preventDefault();
      const span = session.current(g.range);
      session.move(
        zoom
          ? zoomSpan(span, g.extent, wheelZoomFactor(dy), axis()?.toValue(x) ?? span.min, g.minWidth)
          : panSpan(span, g.extent, (dx * (span.max - span.min)) / chart.plotWidth),
      );
      session.endSoon();
    };

    let drag: { id: number; x: number; span: Span; moved: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      const g = latest.current;
      if (!g || event.pointerType !== "mouse" || event.button !== 0 || !locate(event).inside) return;
      drag = { id: event.pointerId, x: event.clientX, span: session.current(g.range), moved: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (!drag) {
        element.style.cursor = locate(event).inside ? "grab" : "";
        return;
      }
      const g = latest.current;
      const dx = event.clientX - drag.x;
      if (!g || (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX)) return;
      if (!drag.moved) {
        drag.moved = true;
        element.setPointerCapture(drag.id);
        element.style.cursor = "grabbing";
      }
      const width = drag.span.max - drag.span.min;
      session.move(panSpan(drag.span, g.extent, (-dx * width) / chart.plotWidth));
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
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.style.cursor = "";
      session.cancel();
    };
  }, [ref, enabled, sync]);
}
