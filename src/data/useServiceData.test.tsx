import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { queryKeys } from "./query-keys";
import { stubApi } from "@/test/render";
import {
  prefetchCatalogs,
  useCharlieLatest,
  useSeriesList,
  useTimeseries,
  type TimeseriesParams,
} from "./useServiceData";

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

describe("prefetchCatalogs", () => {
  it("starts loading every service catalog into the cache", async () => {
    const fetchMock = stubApi(() => Response.json({ service: "alpha", series: [] }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    prefetchCatalogs(client);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/alpha/series",
      "/api/bravo/series",
      "/api/charlie/series",
    ]);
    await waitFor(() => expect(client.getQueryData(queryKeys.seriesList("bravo"))).toBeDefined());
  });

  it("does not refetch a catalog that is already fresh", async () => {
    const fetchMock = stubApi(() => Response.json({ service: "alpha", series: [] }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    prefetchCatalogs(client);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    prefetchCatalogs(client);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

  it("loads a long 5-minute period in pieces and joins them into one series", async () => {
    const fetchMock = stubApi((url) => {
      // Each piece answers with one point at the start of its window.
      const t = Date.parse(url.searchParams.get("from")!);
      return Response.json({
        service: "alpha",
        frequency: "5min",
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        series: [{ seriesId: "A-0001", t: [t], fields: { price: [t / 1e9] } }],
      });
    });
    const params: TimeseriesParams = {
      ids: ["A-0001"],
      frequency: "5min",
      from: "2021-01-04",
      to: "2025-12-31",
      fields: ["price", "score", "momentum", "rank", "net_value"],
    };
    const { result } = renderHook(() => useTimeseries("alpha", params), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const windows = fetchMock.mock.calls.map(([url]) => new URL(String(url), "http://app.test").searchParams);
    expect(windows.length).toBeGreaterThan(1);
    expect(windows[0]?.get("from")).toBe("2021-01-04");
    expect(windows.at(-1)?.get("to")).toBe("2025-12-31");
    const series = result.current.data?.series[0];
    expect(series?.t).toHaveLength(windows.length);
    expect(series?.t).toEqual([...(series?.t ?? [])].sort((a, b) => a - b)); // in date order
    expect(series?.fields.price).toHaveLength(windows.length);
    expect([result.current.data?.from, result.current.data?.to]).toEqual(["2021-01-04", "2025-12-31"]);
  });

  it("asks once for a short 5-minute period", async () => {
    const fetchMock = stubApi(() => Response.json({ series: [] }));
    const params: TimeseriesParams = {
      ids: ["A-0001"],
      frequency: "5min",
      from: "2025-12-01",
      to: "2025-12-31",
      fields: ["price"],
    };
    const { result } = renderHook(() => useTimeseries("alpha", params), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
