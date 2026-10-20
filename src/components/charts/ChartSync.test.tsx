import type { HighchartsReactRefObject } from "@highcharts/react/Stock";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChartSyncProvider, showCrosshairAt, useChartSync } from "./ChartSync";

type Chart = HighchartsReactRefObject["chart"];

/** A stand-in with just what the sync touches: one x-axis and one series of points. */
function fakeChart(xs: number[], extremes = { min: 0, max: 100 }) {
  const axis = { drawCrosshair: vi.fn(), hideCrosshair: vi.fn(), setExtremes: vi.fn(), getExtremes: () => extremes };
  const points = xs.map((x) => ({ x }));
  const pointer = { reset: vi.fn() };
  return {
    chart: { xAxis: [axis], series: [{ visible: true, points }], pointer } as unknown as Chart,
    axis,
    points,
    pointer,
  };
}

describe("showCrosshairAt", () => {
  it("draws the crosshair at the nearest point", () => {
    const { chart, axis, points } = fakeChart([10, 20, 30, 40]);
    showCrosshairAt(chart, 24);
    expect(axis.drawCrosshair).toHaveBeenCalledWith(undefined, points[1]);
    showCrosshairAt(chart, 26);
    expect(axis.drawCrosshair).toHaveBeenLastCalledWith(undefined, points[2]);
  });

  it("hides it when the pointer leaves or the date is outside this chart's view", () => {
    const { chart, axis } = fakeChart([10, 20, 30], { min: 15, max: 35 });
    showCrosshairAt(chart, null);
    showCrosshairAt(chart, 5);
    expect(axis.hideCrosshair).toHaveBeenCalledTimes(2);
    expect(axis.drawCrosshair).not.toHaveBeenCalled();
  });

  it("does nothing for a chart without axes (e.g. already destroyed)", () => {
    expect(() => showCrosshairAt({} as Chart, 10)).not.toThrow();
  });
});

describe("ChartSyncProvider", () => {
  const wrapper = ({ children }: { children: ReactNode }) => <ChartSyncProvider>{children}</ChartSyncProvider>;

  it("mirrors a hover into every other registered chart, not the source", () => {
    const { result } = renderHook(() => useChartSync(), { wrapper });
    const sync = result.current;
    const a = fakeChart([10, 20]);
    const b = fakeChart([10, 20]);
    const c = fakeChart([10, 20]);
    sync?.register(a.chart);
    sync?.register(b.chart);
    const unregisterC = sync?.register(c.chart);
    unregisterC?.();

    sync?.hover(a.chart, 20);
    expect(a.axis.drawCrosshair).not.toHaveBeenCalled();
    expect(b.axis.drawCrosshair).toHaveBeenCalledWith(undefined, b.points[1]);
    expect(c.axis.drawCrosshair).not.toHaveBeenCalled();

    sync?.hover(a.chart, null);
    expect(b.axis.hideCrosshair).toHaveBeenCalled();
  });

  it("shows a previewed range in every chart and tells the listeners", () => {
    const { result } = renderHook(() => useChartSync(), { wrapper });
    const sync = result.current;
    const a = fakeChart([10, 20]);
    const b = fakeChart([10, 20]);
    sync?.register(a.chart);
    sync?.register(b.chart);
    const listener = vi.fn();
    const stop = sync?.onPreview(listener);

    sync?.preview({ min: 5, max: 15 });
    expect(a.axis.setExtremes).toHaveBeenCalledWith(5, 15, true, false);
    expect(b.axis.setExtremes).toHaveBeenCalledWith(5, 15, true, false);
    expect(a.pointer.reset).toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith({ min: 5, max: 15 });

    stop?.();
    sync?.preview({ min: 6, max: 16 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("is absent outside a provider, so charts don't sync", () => {
    expect(renderHook(() => useChartSync()).result.current).toBeNull();
  });
});
