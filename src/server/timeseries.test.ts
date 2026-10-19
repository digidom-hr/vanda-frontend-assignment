// @vitest-environment node
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SeriesMeta } from "@/services/types";
import { createCatalogCache } from "./catalog";
import { RequestError } from "./http";
import { getTimeseries, MAX_POINTS_PER_RESPONSE } from "./timeseries";

const BASE = "http://upstream.test";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => vi.stubEnv("MOCK_API_URL", BASE));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const series = (id: string, frequencies: SeriesMeta["frequencies"], fields: string[]): SeriesMeta => ({
  service: "bravo",
  id,
  name: id,
  facets: [],
  frequencies,
  unit: "USD",
  fields,
});

const CATALOG = [
  series("B-1", ["daily", "weekly"], ["net", "gross"]),
  series("B-2", ["daily", "weekly"], ["net"]),
  series("B-3", ["weekly"], ["net"]),
];
const catalog = createCatalogCache({ load: async () => CATALOG });

const row = (ts: string, id: string, metric: string, value: number, frequency = "daily") => ({
  ts,
  series_id: id,
  metric,
  frequency,
  value,
  unit: "USD",
});

/** Serves `rows` from the upstream timeseries endpoint and records the query it received. */
function serveRows(rows: unknown[]) {
  const seen: URLSearchParams[] = [];
  server.use(
    http.get(`${BASE}/bravo/timeseries`, ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        data: rows,
        pagination: { page: 1, page_size: 10000, total_pages: 1, has_next: false },
      });
    }),
  );
  return seen;
}

const run = (query: string) => getTimeseries("bravo", new URLSearchParams(query), catalog);

async function expectRequestError(promise: Promise<unknown>, status: number, message: RegExp) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(RequestError);
  expect((error as RequestError).status).toBe(status);
  expect((error as RequestError).message).toMatch(message);
}

describe("getTimeseries", () => {
  it("returns requested series in request order with aligned columns", async () => {
    serveRows([
      row("2025-03-03", "B-1", "net", 1),
      row("2025-03-03", "B-1", "gross", 10),
      row("2025-03-03", "B-2", "net", 2),
    ]);
    const res = await run("ids=B-2,B-1&frequency=daily");
    expect(res.series.map((s) => s.seriesId)).toEqual(["B-2", "B-1"]);
    expect(res.series[1]?.fields).toEqual({ net: [1], gross: [10] });
    // B-2 has no gross metric: the column is present but empty.
    expect(res.series[0]?.fields).toEqual({ net: [2], gross: [null] });
  });

  it("forwards ids, frequency and dates to the upstream", async () => {
    const seen = serveRows([]);
    const res = await run("ids=B-1,B-2&frequency=weekly&from=2025-01-01&to=2025-06-30");
    expect(seen[0]?.get("series_ids")).toBe("B-1,B-2");
    expect(seen[0]?.get("frequency")).toBe("weekly");
    expect(seen[0]?.get("start_date")).toBe("2025-01-01");
    expect(seen[0]?.get("end_date")).toBe("2025-06-30");
    expect([res.frequency, res.from, res.to]).toEqual(["weekly", "2025-01-01", "2025-06-30"]);
  });

  it("defaults to the first series' first frequency and all of its fields", async () => {
    serveRows([]);
    const res = await run("ids=B-1");
    expect(res.frequency).toBe("daily");
    expect(Object.keys(res.series[0]?.fields ?? {})).toEqual(["net", "gross"]);
  });

  it("returns only the requested fields", async () => {
    serveRows([row("2025-03-03", "B-1", "net", 1), row("2025-03-03", "B-1", "gross", 10)]);
    const res = await run("ids=B-1&fields=gross");
    expect(res.series[0]?.fields).toEqual({ gross: [10] });
  });

  it("returns empty columns for a series with no rows in range", async () => {
    serveRows([]);
    const res = await run("ids=B-1&fields=net");
    expect(res.series).toEqual([{ seriesId: "B-1", t: [], fields: { net: [] } }]);
  });

  it("de-duplicates ids", async () => {
    const seen = serveRows([]);
    await run("ids=B-1,B-1, B-1");
    expect(seen[0]?.get("series_ids")).toBe("B-1");
  });

  it.each([
    ["", 400, /`ids` /],
    ["ids=", 400, /`ids` is required/],
    ["ids=B-1&from=2025-02-30", 400, /`from` must be a YYYY-MM-DD date/],
    ["ids=B-1&from=2025-03-01&to=2025-02-01", 400, /`from` must not be after `to`/],
    ["ids=B-9", 404, /Unknown series: B-9/],
    ["ids=B-1,B-3&frequency=daily", 400, /B-3 has no daily data \(available: weekly\)/],
    ["ids=B-1&frequency=5min", 400, /B-1 has no 5min data/],
    ["ids=B-2&fields=gross", 400, /Unknown fields: gross \(available: net\)/],
  ])("rejects %j before calling upstream", async (query, status, message) => {
    // No upstream handler: any upstream call would fail the test.
    await expectRequestError(run(query), status, message);
  });

  it("limits the number of series per request", async () => {
    const ids = Array.from({ length: 21 }, (_, i) => `X-${i}`).join(",");
    await expectRequestError(run(`ids=${ids}`), 400, /At most 20 series/);
  });

  it("refuses responses over the size budget", async () => {
    const n = Math.ceil(MAX_POINTS_PER_RESPONSE / 3) + 1;
    const start = Date.UTC(2000, 0, 1);
    serveRows(
      Array.from({ length: n }, (_, i) => [
        row(new Date(start + i * 86_400_000).toISOString().slice(0, 10), "B-1", "net", i),
        row(new Date(start + i * 86_400_000).toISOString().slice(0, 10), "B-1", "gross", i),
      ]).flat(),
    );
    await expectRequestError(run("ids=B-1"), 413, /shorter date range/);
  });
});
