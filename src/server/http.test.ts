// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { ApiErrorBody } from "@/services/api-types";
import { UpstreamError, type UpstreamErrorKind } from "./errors";
import { errorResponse, jsonResponse, RequestError } from "./http";

async function body(res: Response): Promise<ApiErrorBody["error"]> {
  return ((await res.json()) as ApiErrorBody).error;
}

describe("jsonResponse", () => {
  it("sets the cache policy", () => {
    expect(jsonResponse({}, "public, max-age=1").headers.get("cache-control")).toBe("public, max-age=1");
  });
});

describe("errorResponse", () => {
  it("passes request errors through", async () => {
    const res = errorResponse(new RequestError(404, "not_found", "Unknown series: X"), "test");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await body(res)).toEqual({ code: "not_found", message: "Unknown series: X", retryable: false });
  });

  it.each<[UpstreamErrorKind, number | undefined, number, string, boolean]>([
    ["timeout", undefined, 504, "timeout", true],
    ["unavailable", undefined, 503, "unavailable", true],
    ["bad_request", 400, 502, "upstream_error", false],
    ["not_found", 404, 404, "not_found", false],
    ["upstream_error", 500, 502, "upstream_error", true],
    ["invalid_response", undefined, 502, "upstream_error", false],
    ["too_large", undefined, 413, "too_large", false],
  ])("maps upstream %s to HTTP %i", async (kind, upstreamStatus, status, code, retryable) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new UpstreamError(kind, "/alpha/series: secret detail", upstreamStatus), "test");
    expect(res.status).toBe(status);
    const error = await body(res);
    expect([error.code, error.retryable]).toEqual([code, retryable]);
    if (status >= 500) expect(error.message).not.toContain("secret detail");
  });

  it("hides unexpected errors behind a generic 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new TypeError("x is undefined"), "test");
    expect(res.status).toBe(500);
    expect(await body(res)).toEqual({ code: "internal", message: "Something went wrong.", retryable: true });
  });
});
