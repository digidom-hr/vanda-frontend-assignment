import { describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, apiUrl } from "./api-client";

function stubFetch(response: Response | Error | DOMException) {
  const fetchMock = vi.fn(async () => {
    if (!(response instanceof Response)) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe("apiUrl", () => {
  it("builds a same-origin API path with encoded params", () => {
    expect(apiUrl("/alpha/timeseries", { ids: ["A-0001", "A-0002"], from: "2025-01-01", to: undefined })).toBe(
      "/api/alpha/timeseries?ids=A-0001%2CA-0002&from=2025-01-01",
    );
    expect(apiUrl("search")).toBe("/api/search");
  });
});

describe("apiGet", () => {
  it("returns the JSON body on success", async () => {
    const fetchMock = stubFetch(Response.json({ ok: 1 }));
    await expect(apiGet("search", { q: "acme" })).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=acme", expect.objectContaining({ signal: undefined }));
  });

  it("turns an API error body into an ApiError with the server's code and retry hint", async () => {
    stubFetch(
      Response.json({ error: { code: "unavailable", message: "Bravo is down", retryable: true } }, { status: 503 }),
    );
    const error = await captureError(apiGet("bravo/series"));
    expect([error.code, error.message, error.status, error.retryable]).toEqual([
      "unavailable",
      "Bravo is down",
      503,
      true,
    ]);
  });

  it("handles a non-JSON failure", async () => {
    stubFetch(new Response("<html>Bad gateway</html>", { status: 502 }));
    const error = await captureError(apiGet("alpha/series"));
    expect([error.code, error.status, error.retryable]).toEqual(["internal", 502, true]);
  });

  it("treats a 4xx without a body as not retryable", async () => {
    stubFetch(new Response(null, { status: 404 }));
    expect((await captureError(apiGet("alpha/series"))).retryable).toBe(false);
  });

  it("reports a network failure as retryable", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    const error = await captureError(apiGet("alpha/series"));
    expect([error.code, error.retryable]).toEqual(["network", true]);
  });

  it("lets cancellation through untouched", async () => {
    const controller = new AbortController();
    controller.abort();
    stubFetch(new DOMException("Aborted", "AbortError"));
    await expect(apiGet("alpha/series", {}, controller.signal)).rejects.toThrow("Aborted");
  });
});
