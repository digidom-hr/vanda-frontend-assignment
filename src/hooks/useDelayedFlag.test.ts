import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDelayedFlag } from "./useDelayedFlag";

describe("useDelayedFlag", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("turns on only after staying active for the delay", () => {
    const { result } = renderHook(() => useDelayedFlag(true, 5000));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(4999));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("turns off immediately when inactive, and restarts the delay", () => {
    const { result, rerender } = renderHook(({ on }) => useDelayedFlag(on, 1000), { initialProps: { on: true } });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(true);
    rerender({ on: false });
    expect(result.current).toBe(false);
    rerender({ on: true });
    expect(result.current).toBe(false);
  });
});
