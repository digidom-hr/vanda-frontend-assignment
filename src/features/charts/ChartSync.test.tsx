import type { HighchartsReactRefObject } from "@highcharts/react/Stock";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChartSyncProvider, showCrosshairAt, useChartSync } from "./ChartSync";

type Chart = HighchartsReactRefObject["chart"];

/** A stand-in with just what the sync touches: one x-axis, one series of points and a pointer. */
function fakeChart(xs: number[] = [10, 20], extremes = { min: 0, max: 100 }) {
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
  const setup = (linkHover: boolean) => {
    const state = { linkHover };
    const view = renderHook(() => useChartSync(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ChartSyncProvider linkHover={state.linkHover}>{children}</ChartSyncProvider>
      ),
    });
    const setLinkHover = (on: boolean) => {
      state.linkHover = on;
      view.rerender();
    };
    return { sync: view.result.current, setLinkHover };
  };

  it("shows a previewed range in every registered chart", () => {
    const { sync } = setup(false);
    const a = fakeChart();
    const b = fakeChart();
    const c = fakeChart();
    sync?.register(a.chart);
    sync?.register(b.chart);
    const unregisterC = sync?.register(c.chart);
    unregisterC?.();

    sync?.preview({ min: 5, max: 15 });
    expect(a.axis.setExtremes).toHaveBeenCalledWith(5, 15, true, false);
    expect(b.axis.setExtremes).toHaveBeenCalledWith(5, 15, true, false);
    expect(a.pointer.reset).toHaveBeenCalled();
    expect(c.axis.setExtremes).not.toHaveBeenCalled();
  });

  it("keeps hover in its own chart unless Link hover is on", () => {
    const { sync, setLinkHover } = setup(false);
    const a = fakeChart();
    const b = fakeChart();
    sync?.register(a.chart);
    sync?.register(b.chart);

    sync?.hover(a.chart, 20);
    expect(b.axis.drawCrosshair).not.toHaveBeenCalled();

    setLinkHover(true);
    sync?.hover(a.chart, 20);
    expect(a.axis.drawCrosshair).not.toHaveBeenCalled(); // the source draws its own
    expect(b.axis.drawCrosshair).toHaveBeenCalledWith(undefined, b.points[1]);
    sync?.hover(a.chart, null);
    expect(b.axis.hideCrosshair).toHaveBeenCalledTimes(1);

    // Turning it off clears dates still marked elsewhere.
    sync?.hover(a.chart, 20);
    setLinkHover(false);
    expect(b.axis.hideCrosshair).toHaveBeenCalledTimes(2);
  });

  it("is absent outside a provider", () => {
    expect(renderHook(() => useChartSync()).result.current).toBeNull();
  });
});
