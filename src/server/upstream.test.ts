// @vitest-environment node
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApiBaseUrl } from "./config";
import { UpstreamError } from "./errors";
import { buildUpstreamUrl, upstreamGet, upstreamGetAllPages } from "./upstream";

const BASE = "http://upstream.test";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => vi.stubEnv("MOCK_API_URL", BASE));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Fast retries so tests don't wait on real backoff. */
const fast = { baseDelayMs: 1 } as const;

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the promise to reject");
}

async function expectUpstreamError(promise: Promise<unknown>, kind: UpstreamError["kind"]): Promise<UpstreamError> {
  const error = await captureError(promise);
  expect(error).toBeInstanceOf(UpstreamError);
  expect((error as UpstreamError).kind).toBe(kind);
  return error as UpstreamError;
}

describe("mockApiBaseUrl", () => {
  it("defaults to the local mock API", () => {
    vi.stubEnv("MOCK_API_URL", "");
    expect(mockApiBaseUrl()).toBe("http://localhost:4000");
  });

  it("uses MOCK_API_URL without trailing slashes", () => {
    vi.stubEnv("MOCK_API_URL", "https://api.example.com/base//");
    expect(mockApiBaseUrl()).toBe("https://api.example.com/base");
  });

  it.each(["not a url", "ftp://example.com"])("rejects %s", (value) => {
    vi.stubEnv("MOCK_API_URL", value);
    expect(() => mockApiBaseUrl()).toThrow(/MOCK_API_URL/);
  });
});

describe("buildUpstreamUrl", () => {
  it("joins arrays with commas and skips undefined params", () => {
    const url = buildUpstreamUrl("/alpha/timeseries", {
      series_ids: ["A-0001", "A-0002"],
      page: 2,
      start_date: undefined,
    });
    expect(url.href).toBe(`${BASE}/alpha/timeseries?series_ids=A-0001%2CA-0002&page=2`);
  });
});

describe("upstreamGet", () => {
  it("returns the parsed JSON body", async () => {
    server.use(http.get(`${BASE}/charlie/series`, () => HttpResponse.json({ ok: true })));
    await expect(upstreamGet("charlie/series")).resolves.toEqual({ ok: true });
  });

  it.each([
    [400, "bad_request"],
    [404, "not_found"],
  ] as const)("maps HTTP %i to %s with the service's message and does not retry", async (status, kind) => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/alpha/timeseries`, () => {
        calls++;
        return HttpResponse.json({ error: "series_ids is required" }, { status });
      }),
    );
    const error = await expectUpstreamError(upstreamGet("alpha/timeseries", {}, fast), kind);
    expect(error.status).toBe(status);
    expect(error.message).toContain("series_ids is required");
    expect(calls).toBe(1);
  });

  it("retries a 5xx and succeeds", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/bravo/series`, () => {
        calls++;
        return calls === 1 ? HttpResponse.json({ error: "boom" }, { status: 503 }) : HttpResponse.json({ ok: calls });
      }),
    );
    await expect(upstreamGet("bravo/series", {}, fast)).resolves.toEqual({ ok: 2 });
  });

  it("gives up after the configured retries", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/bravo/series`, () => {
        calls++;
        return new HttpResponse("oops", { status: 500 });
      }),
    );
    const error = await expectUpstreamError(upstreamGet("bravo/series", {}, { ...fast, retries: 2 }), "upstream_error");
    expect(error.status).toBe(500);
    expect(calls).toBe(3);
  });

  it("reports an unreachable service as unavailable, after retrying", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/alpha/series`, () => {
        calls++;
        return HttpResponse.error();
      }),
    );
    await expectUpstreamError(upstreamGet("alpha/series", {}, { ...fast, retries: 1 }), "unavailable");
    expect(calls).toBe(2);
  });

  it("times out a slow response", async () => {
    server.use(
      http.get(`${BASE}/alpha/series`, async () => {
        await delay(500);
        return HttpResponse.json({});
      }),
    );
    await expectUpstreamError(upstreamGet("alpha/series", {}, { timeoutMs: 30, retries: 0 }), "timeout");
  });

  it("rejects a non-JSON success response as invalid", async () => {
    server.use(http.get(`${BASE}/alpha/series`, () => new HttpResponse("<html>", { status: 200 })));
    await expectUpstreamError(upstreamGet("alpha/series", {}, fast), "invalid_response");
  });

  it("propagates caller cancellation without retrying", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/alpha/series`, async () => {
        calls++;
        await delay(500);
        return HttpResponse.json({});
      }),
    );
    const controller = new AbortController();
    const pending = upstreamGet("alpha/series", {}, { ...fast, signal: controller.signal });
    setTimeout(() => controller.abort(new Error("client went away")), 20);
    await expect(pending).rejects.toThrow("client went away");
    expect(calls).toBe(1);
  });
});

describe("upstreamGetAllPages", () => {
  /** Serves `total` items as pages, the way the mock API paginates. */
  function servePages(total: number, onRequest?: (page: number) => Response | undefined) {
    const seen: { page: number; pageSize: number }[] = [];
    server.use(
      http.get(`${BASE}/alpha/timeseries`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        const page = Number(params.get("page"));
        const pageSize = Number(params.get("page_size"));
        seen.push({ page, pageSize });
        const override = onRequest?.(page);
        if (override) return override;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const start = (page - 1) * pageSize;
        const data = Array.from({ length: Math.max(0, Math.min(pageSize, total - start)) }, (_, i) => start + i);
        return HttpResponse.json({
          data,
          pagination: { page, page_size: pageSize, total_pages: totalPages, has_next: page < totalPages },
        });
      }),
    );
    return seen;
  }

  it("concatenates every page in order", async () => {
    const seen = servePages(25);
    const items = await upstreamGetAllPages("alpha/timeseries", { series_ids: ["A-0001"] }, { pageSize: 10 });
    expect(items).toEqual(Array.from({ length: 25 }, (_, i) => i));
    expect(seen.map((s) => s.page).sort()).toEqual([1, 2, 3]);
    expect(seen.every((s) => s.pageSize === 10)).toBe(true);
  });

  it("requests the largest page size by default", async () => {
    const seen = servePages(3);
    await upstreamGetAllPages("alpha/timeseries");
    expect(seen).toEqual([{ page: 1, pageSize: 10_000 }]);
  });

  it("handles an empty result", async () => {
    servePages(0);
    await expect(upstreamGetAllPages("alpha/timeseries")).resolves.toEqual([]);
  });

  it("refuses results that span too many pages before fetching them", async () => {
    const seen = servePages(100);
    await expectUpstreamError(upstreamGetAllPages("alpha/timeseries", {}, { pageSize: 10, maxPages: 5 }), "too_large");
    expect(seen).toHaveLength(1);
  });

  it("rejects an unexpected envelope", async () => {
    server.use(http.get(`${BASE}/alpha/timeseries`, () => HttpResponse.json({ rows: [] })));
    await expectUpstreamError(upstreamGetAllPages("alpha/timeseries"), "invalid_response");
  });

  it("fails as a whole when one page fails", async () => {
    servePages(30, (page) => (page === 2 ? HttpResponse.json({ error: "nope" }, { status: 404 }) : undefined));
    await expectUpstreamError(upstreamGetAllPages("alpha/timeseries", {}, { pageSize: 10, ...fast }), "not_found");
  });

  it("never runs more pages in parallel than the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    server.use(
      http.get(`${BASE}/alpha/timeseries`, async ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        inFlight++;
        peak = Math.max(peak, inFlight);
        await delay(10);
        inFlight--;
        return HttpResponse.json({
          data: [page],
          pagination: { page, page_size: 1, total_pages: 9, has_next: page < 9 },
        });
      }),
    );
    const items = await upstreamGetAllPages("alpha/timeseries", {}, { pageSize: 1, concurrency: 3 });
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(peak).toBeLessThanOrEqual(3);
  });
});
