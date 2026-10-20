import { act, renderHook } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDashboardState } from "./useDashboardState";

const ALPHA = { frequencies: ["daily", "5min"] as const };

function setup(search = "") {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} rateLimitFactor={0}>
      {children}
    </NuqsTestingAdapter>
  );
  const view = renderHook(() => useDashboardState(ALPHA), { wrapper });
  const lastUrl = () => onUrlUpdate.mock.calls.at(-1)?.[0];
  return { ...view, onUrlUpdate, lastUrl };
}

describe("useDashboardState", () => {
  it("reads the view from the URL", () => {
    const { result } = setup("?series=A-0001,A-0013&freq=5min&range=6M&tf=ma:20,pct");
    expect(result.current[0]).toEqual({
      series: ["A-0001", "A-0013"],
      frequency: "5min",
      preset: "6M",
      from: null,
      to: null,
      transforms: [
        { kind: "movingAverage", window: 20 },
        { kind: "pctChange", periods: 1 },
      ],
    });
  });

  it("falls back to defaults for invalid values", () => {
    const { result } = setup("?series=<x>&freq=weekly&range=10Y&from=2025-02-30&tf=nope");
    expect(result.current[0]).toEqual({
      series: [],
      frequency: null,
      preset: "1Y",
      from: null,
      to: null,
      transforms: [],
    });
  });

  it("pushes a history entry when the series selection changes", async () => {
    const { result, lastUrl } = setup();
    await act(() => result.current[1].selectSeries(["A-0004"]));
    expect(lastUrl()?.queryString).toBe("?series=A-0004");
    expect(lastUrl()?.options.history).toBe("push");
  });

  it("toggles series in and out of a comparison", async () => {
    const { result } = setup("?series=A-0001");
    await act(() => result.current[1].toggleCompare("A-0013"));
    expect(result.current[0].series).toEqual(["A-0001", "A-0013"]);
    await act(() => result.current[1].toggleCompare("A-0001"));
    expect(result.current[0].series).toEqual(["A-0013"]);
  });

  it("replaces history for range and transform tweaks", async () => {
    const { result, lastUrl } = setup("?series=A-0001");
    await act(() => result.current[1].setCustomRange("2025-07-01", "2025-09-30"));
    expect(lastUrl()?.queryString).toBe("?series=A-0001&from=2025-07-01&to=2025-09-30");
    expect(lastUrl()?.options.history).toBe("replace");

    await act(() => result.current[1].setTransforms([{ kind: "zScore", window: 60 }]));
    expect(lastUrl()?.searchParams.get("tf")).toBe("z:60");
  });

  it("clears a custom range when a preset is chosen, and omits defaults from the URL", async () => {
    const { result, lastUrl } = setup("?series=A-0001&from=2025-07-01&to=2025-09-30");
    await act(() => result.current[1].setPreset("1Y"));
    expect(lastUrl()?.queryString).toBe("?series=A-0001");
  });
});
