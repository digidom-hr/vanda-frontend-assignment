// @vitest-environment node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ApiErrorBody,
  CharlieLatestResponse,
  SearchResponse,
  SeriesListResponse,
  TimeseriesResponse,
} from "@/services/api-types";

const BASE = "http://upstream.test";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => {
  vi.stubEnv("MOCK_API_URL", BASE);
  // Each test gets fresh modules, so the catalog cache starts empty.
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const page = (data: unknown[]) =>
  HttpResponse.json({ data, pagination: { page: 1, page_size: 10000, total_pages: 1, has_next: false } });

const CHARLIE_SERIES = {
  series_id: "C-0001",
  name: "North America Equity Composite",
  category: "equity",
  frequencies: ["daily"],
  unit: "score",
};

const ctx = (service: string) => ({ params: Promise.resolve({ service }) });

describe("GET /api/[service]/series", () => {
  it("returns the normalised catalog with a cache policy", async () => {
    server.use(http.get(`${BASE}/charlie/series`, () => page([CHARLIE_SERIES])));
    const { GET } = await import("./[service]/series/route");
    const res = await GET(new Request("http://app.test/api/charlie/series"), ctx("charlie"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("max-age");
    const body = (await res.json()) as SeriesListResponse;
    expect(body.series.map((s) => [s.service, s.id])).toEqual([["charlie", "C-0001"]]);
  });

  it("404s for an unregistered service without calling upstream", async () => {
    const { GET } = await import("./[service]/series/route");
    const res = await GET(new Request("http://app.test/api/delta/series"), ctx("delta"));
    expect(res.status).toBe(404);
    expect(((await res.json()) as ApiErrorBody).error.code).toBe("not_found");
  });

  it("reports an unreachable service as a retryable 503", async () => {
    server.use(http.get(`${BASE}/charlie/series`, () => HttpResponse.error()));
    const { GET } = await import("./[service]/series/route");
    const res = await GET(new Request("http://app.test/api/charlie/series"), ctx("charlie"));
    expect(res.status).toBe(503);
    expect(((await res.json()) as ApiErrorBody).error).toMatchObject({ code: "unavailable", retryable: true });
  });
});

describe("GET /api/[service]/timeseries", () => {
  it("validates against the catalog and returns columns", async () => {
    server.use(
      http.get(`${BASE}/charlie/series`, () => page([CHARLIE_SERIES])),
      http.get(`${BASE}/charlie/timeseries`, () =>
        page([
          { ts: "2025-03-03", series_id: "C-0001", value: 0.5, unit: "score" },
          { ts: "2025-03-04", series_id: "C-0001", value: 0.7, unit: "score" },
        ]),
      ),
    );
    const { GET } = await import("./[service]/timeseries/route");
    const res = await GET(new Request("http://app.test/api/charlie/timeseries?ids=C-0001"), ctx("charlie"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as TimeseriesResponse;
    expect(body.series[0]).toEqual({
      seriesId: "C-0001",
      t: [Date.UTC(2025, 2, 3), Date.UTC(2025, 2, 4)],
      fields: { value: [0.5, 0.7] },
    });
  });

  it("returns 400 with an actionable message for invalid queries", async () => {
    server.use(http.get(`${BASE}/charlie/series`, () => page([CHARLIE_SERIES])));
    const { GET } = await import("./[service]/timeseries/route");
    const res = await GET(
      new Request("http://app.test/api/charlie/timeseries?ids=C-0001&frequency=weekly"),
      ctx("charlie"),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiErrorBody).error.message).toBe("C-0001 has no weekly data (available: daily)");
  });
});

describe("GET /api/charlie/latest", () => {
  it("returns latest values with signals", async () => {
    server.use(
      http.get(`${BASE}/charlie/latest`, () =>
        page([{ ...CHARLIE_SERIES, ts: "2025-12-31", value: -1.4, signal: "low" }]),
      ),
    );
    const { GET } = await import("./charlie/latest/route");
    const res = await GET(new Request("http://app.test/api/charlie/latest"));
    const body = (await res.json()) as CharlieLatestResponse;
    expect(body.latest).toEqual([
      {
        seriesId: "C-0001",
        name: "North America Equity Composite",
        category: "equity",
        t: Date.UTC(2025, 11, 31),
        value: -1.4,
        unit: "score",
        signal: "low",
      },
    ]);
  });
});

describe("GET /api/search", () => {
  const ALPHA_SERIES = {
    series_id: "A-0001",
    name: "Acme Corp (ACMC)",
    group: "Technology",
    frequencies: ["daily"],
    unit: "USD",
  };

  it("returns partial results without caching them when a service is down", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(
      http.get(`${BASE}/alpha/series`, () => page([ALPHA_SERIES])),
      http.get(`${BASE}/bravo/series`, () => HttpResponse.error()),
      http.get(`${BASE}/charlie/series`, () => page([{ ...CHARLIE_SERIES, name: "Acme Corp Composite" }])),
    );
    const { GET } = await import("./search/route");
    const res = await GET(new Request("http://app.test/api/search?q=acme"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as SearchResponse;
    expect(body.results.map((r) => r.id)).toEqual(["A-0001", "C-0001"]);
    expect(body.services).toContainEqual({ service: "bravo", status: "unavailable" });
  });

  it("returns a retryable 503 when no service can be searched", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(http.get(`${BASE}/:service/series`, () => HttpResponse.error()));
    const { GET } = await import("./search/route");
    const res = await GET(new Request("http://app.test/api/search?q=acme"));
    expect(res.status).toBe(503);
    expect(((await res.json()) as ApiErrorBody).error.retryable).toBe(true);
  });
});
