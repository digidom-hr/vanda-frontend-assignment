/**
 * Browser-side client for this app's own API (`/api/...`). Every failure
 * becomes an `ApiError` carrying the server's code and whether retrying makes
 * sense, so the query layer and the UI can react without parsing responses.
 */
import type { ApiErrorBody, ApiErrorCode } from "@/services/api-types";

export type ApiClientErrorCode = ApiErrorCode | "network";

export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    readonly code: ApiClientErrorCode,
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export type ApiParams = Readonly<Record<string, string | number | readonly string[] | undefined>>;

export function apiUrl(path: string, params: ApiParams = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const query = search.toString();
  return `/api/${path.replace(/^\/+/, "")}${query ? `?${query}` : ""}`;
}

function isErrorBody(body: unknown): body is ApiErrorBody {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const error = (body as { error: unknown }).error;
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

export async function apiGet<T>(path: string, params?: ApiParams, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path, params), { signal, headers: { accept: "application/json" } });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new ApiError("network", "Can't reach the server. Check your connection.", null, true);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (response.ok) return body as T;
  if (isErrorBody(body)) {
    const { code, message, retryable } = body.error;
    throw new ApiError(code, message, response.status, retryable);
  }
  throw new ApiError("internal", `Request failed (HTTP ${response.status}).`, response.status, response.status >= 500);
}
