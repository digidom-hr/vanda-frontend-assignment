import { describe, expect, it } from "vitest";
import { ApiError } from "./api-client";
import { MAX_RETRIES, retryDelay, shouldRetry } from "./query-client";
import { queryKeys } from "./query-keys";

describe("shouldRetry", () => {
  const transient = new ApiError("unavailable", "down", 503, true);
  const permanent = new ApiError("bad_request", "bad", 400, false);

  it("retries transient API errors up to the limit", () => {
    expect(shouldRetry(0, transient)).toBe(true);
    expect(shouldRetry(MAX_RETRIES - 1, transient)).toBe(true);
    expect(shouldRetry(MAX_RETRIES, transient)).toBe(false);
  });

  it("never retries permanent or unknown errors", () => {
    expect(shouldRetry(0, permanent)).toBe(false);
    expect(shouldRetry(0, new TypeError("bug"))).toBe(false);
  });
});

describe("retryDelay", () => {
  it("backs off exponentially with a ceiling", () => {
    expect([0, 1, 2, 3, 10].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 10_000]);
  });
});

describe("queryKeys", () => {
  it("nests every key under one root so families can be invalidated together", () => {
    expect(queryKeys.search("acme", 20)).toEqual(["api", "search", { query: "acme", limit: 20 }]);
    expect(queryKeys.seriesList("alpha")).toEqual(["api", "series", "alpha"]);
    expect(queryKeys.charlieLatest()[0]).toBe(queryKeys.all[0]);
  });
});
