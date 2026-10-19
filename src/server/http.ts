import "server-only";
import type { ApiErrorBody, ApiErrorCode } from "@/services/api-types";
import { UpstreamError, type UpstreamErrorKind } from "./errors";

/** Cache policy for catalog-like responses (small, rarely changing). */
export const CATALOG_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=600";
/** Cache policy for timeseries data. */
export const DATA_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";

/** A problem with the client's request, detected before or instead of calling upstream. */
export class RequestError extends Error {
  override readonly name = "RequestError";

  constructor(
    readonly status: 400 | 404 | 413,
    readonly code: Extract<ApiErrorCode, "bad_request" | "not_found" | "too_large">,
    message: string,
  ) {
    super(message);
  }
}

const UPSTREAM_STATUS: Record<UpstreamErrorKind, { status: number; code: ApiErrorCode; message?: string }> = {
  timeout: { status: 504, code: "timeout", message: "The data service took too long to respond." },
  unavailable: { status: 503, code: "unavailable", message: "The data service is unavailable." },
  // We validate parameters before calling upstream, so an upstream 400 means
  // the service and this app disagree about the contract: a gateway error.
  bad_request: { status: 502, code: "upstream_error", message: "The data service rejected the request." },
  not_found: { status: 404, code: "not_found" },
  upstream_error: { status: 502, code: "upstream_error", message: "The data service failed." },
  invalid_response: { status: 502, code: "upstream_error", message: "The data service returned unexpected data." },
  too_large: { status: 413, code: "too_large" },
};

export function jsonResponse(body: unknown, cacheControl: string): Response {
  return Response.json(body, { headers: { "cache-control": cacheControl } });
}

function errorJson(status: number, code: ApiErrorCode, message: string, retryable: boolean): Response {
  const body: ApiErrorBody = { error: { code, message, retryable } };
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Converts any thrown value into an API error response. Upstream details are
 * logged server-side but only a generic message reaches the client, except
 * for 404/413 where the message is actionable and safe.
 */
export function errorResponse(error: unknown, context: string): Response {
  if (error instanceof RequestError) {
    return errorJson(error.status, error.code, error.message, false);
  }
  if (error instanceof UpstreamError) {
    const mapped = UPSTREAM_STATUS[error.kind];
    if (mapped.status >= 500) console.error(`[api] ${context}: upstream ${error.kind}: ${error.message}`);
    return errorJson(mapped.status, mapped.code, mapped.message ?? error.message, error.retryable);
  }
  console.error(`[api] ${context}: unexpected error`, error);
  return errorJson(500, "internal", "Something went wrong.", true);
}
