import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { stubApi } from "@/test/render";
import { useCharlieLatest, useSeriesList, useTimeseries, type TimeseriesParams } from "./useServiceData";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const PARAMS: TimeseriesParams = { ids: ["A-0001"], frequency: "daily", from: "2025-01-01", fields: ["price"] };

describe("useSeriesList", () => {
  it("loads a service catalog", async () => {
    const fetchMock = stubApi(() => Response.json({ service: "alpha", series: [] }));
    const { result } = renderHook(() => useSeriesList("alpha"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/alpha/series");
  });
});

describe("useTimeseries", () => {
  it("requests only the given ids, frequency, range and fields", async () => {
    const fetchMock = stubApi(() => Response.json({ series: [] }));
    const { result } = renderHook(() => useTimeseries("alpha", PARAMS), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/api/alpha/timeseries?ids=A-0001&frequency=daily&from=2025-01-01&fields=price",
    );
  });

  it("stays idle without ids", () => {
    const fetchMock = stubApi(() => Response.json({}));
    const none = renderHook(() => useTimeseries("alpha", null), { wrapper: wrapper() });
    const empty = renderHook(() => useTimeseries("alpha", { ...PARAMS, ids: [] }), { wrapper: wrapper() });
    expect(none.result.current.fetchStatus).toBe("idle");
    expect(empty.result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the previous data while new parameters load", async () => {
    let release: () => void = () => {};
    stubApi((url) => {
      const from = url.searchParams.get("from");
      const body = Response.json({ from });
      return from === "2025-06-01" ? new Promise((resolve) => (release = () => resolve(body))) : body;
    });
    const { result, rerender } = renderHook((params: TimeseriesParams) => useTimeseries("alpha", params), {
      wrapper: wrapper(),
      initialProps: PARAMS,
    });
    await waitFor(() => expect(result.current.data).toEqual({ from: "2025-01-01" }));

    rerender({ ...PARAMS, from: "2025-06-01" });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toEqual({ from: "2025-01-01" });

    release();
    await waitFor(() => expect(result.current.data).toEqual({ from: "2025-06-01" }));
  });
});

describe("useCharlieLatest", () => {
  it("loads latest values", async () => {
    const fetchMock = stubApi(() => Response.json({ latest: [] }));
    const { result } = renderHook(() => useCharlieLatest(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/charlie/latest");
  });
});
