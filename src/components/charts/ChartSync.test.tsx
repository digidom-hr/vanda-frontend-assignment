import type { HighchartsReactRefObject } from "@highcharts/react/Stock";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChartSyncProvider, useChartSync } from "./ChartSync";

type Chart = HighchartsReactRefObject["chart"];

/** A stand-in with just what the sync touches: one x-axis and a pointer. */
function fakeChart() {
  const axis = { setExtremes: vi.fn() };
  const pointer = { reset: vi.fn() };
  return { chart: { xAxis: [axis], pointer } as unknown as Chart, axis, pointer };
}

describe("ChartSyncProvider", () => {
  const wrapper = ({ children }: { children: ReactNode }) => <ChartSyncProvider>{children}</ChartSyncProvider>;

  it("shows a previewed range in every registered chart", () => {
    const { result } = renderHook(() => useChartSync(), { wrapper });
    const sync = result.current;
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

  it("is absent outside a provider", () => {
    expect(renderHook(() => useChartSync()).result.current).toBeNull();
  });
});
