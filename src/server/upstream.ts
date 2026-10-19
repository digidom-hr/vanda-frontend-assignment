import "server-only";
import { z } from "zod";
import { mockApiBaseUrl } from "./config";
import { UpstreamError } from "./errors";

/** Largest page the mock API will return (it clamps larger requests). */
export const MAX_PAGE_SIZE = 10_000;

export interface RequestOptions {
  /** Cancels the request (and any retries), e.g. when the client disconnects. */
  signal?: AbortSignal;
  /** Time budget for each attempt, in milliseconds. */
  timeoutMs?: number;
  /** Extra attempts after the first for transient failures. */
  retries?: number;
  /** Base for exponential backoff with full jitter, in milliseconds. */
  baseDelayMs?: number;
}

export interface PagedRequestOptions extends RequestOptions {
  pageSize?: number;
  /** Refuse results that need more pages than this (protects memory and latency). */
  maxPages?: number;
  /** How many pages to fetch in parallel after the first. */
  concurrency?: number;
}

export type QueryValue = string | number | readonly string[] | undefined;
export type QueryParams = Readonly<Record<string, QueryValue>>;

const DEFAULTS = {
  timeoutMs: 8_000,
  retries: 2,
  baseDelayMs: 250,
  maxPages: 50,
  concurrency: 4,
} as const;

const errorBodySchema = z.object({ error: z.string() });

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total_pages: z.number().int().positive(),
  has_next: z.boolean(),
});

const envelopeSchema = z.object({
  data: z.array(z.unknown()),
  pagination: paginationSchema,
});

export function buildUpstreamUrl(path: string, params: QueryParams = {}): URL {
  const url = new URL(`${mockApiBaseUrl()}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return url;
}

function statusError(status: number, body: unknown, url: URL): UpstreamError {
  const parsed = errorBodySchema.safeParse(body);
  const detail = parsed.success ? parsed.data.error : `HTTP ${status}`;
  const message = `${url.pathname}: ${detail}`;
  if (status === 400) return new UpstreamError("bad_request", message, status);
  if (status === 404) return new UpstreamError("not_found", message, status);
  return new UpstreamError("upstream_error", message, status);
}

async function attempt(url: URL, timeoutMs: number, signal: AbortSignal | undefined): Promise<unknown> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const res = await fetch(url, { signal: combined, headers: { accept: "application/json" } });
    let body: unknown;
    try {
      body = await res.json();
    } catch (cause) {
      if (combined.aborted) throw cause;
      if (!res.ok) throw statusError(res.status, undefined, url);
      throw new UpstreamError("invalid_response", `${url.pathname}: response is not JSON`, res.status, { cause });
    }
    if (!res.ok) throw statusError(res.status, body, url);
    return body;
  } catch (cause) {
    if (cause instanceof UpstreamError) throw cause;
    // The caller gave up: surface their abort reason unchanged, never retry it.
    if (signal?.aborted) throw signal.reason;
    if (timeout.aborted) {
      throw new UpstreamError("timeout", `${url.pathname}: no response within ${timeoutMs}ms`, undefined, { cause });
    }
    throw new UpstreamError("unavailable", `${url.pathname}: service unreachable`, undefined, { cause });
  }
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * GET a JSON resource from the mock API. Transient failures (network errors,
 * timeouts, 5xx) are retried with exponential backoff and full jitter; client
 * errors (4xx) and caller cancellation are not.
 */
export async function upstreamGet(path: string, params?: QueryParams, options: RequestOptions = {}): Promise<unknown> {
  const {
    signal,
    timeoutMs = DEFAULTS.timeoutMs,
    retries = DEFAULTS.retries,
    baseDelayMs = DEFAULTS.baseDelayMs,
  } = options;
  const url = buildUpstreamUrl(path, params);
  for (let attemptNo = 0; ; attemptNo++) {
    try {
      return await attempt(url, timeoutMs, signal);
    } catch (error) {
      const canRetry = error instanceof UpstreamError && error.retryable && attemptNo < retries;
      if (!canRetry) throw error;
      await sleep(Math.random() * baseDelayMs * 2 ** attemptNo, signal);
    }
  }
}

function parseEnvelope(body: unknown, path: string): z.infer<typeof envelopeSchema> {
  const parsed = envelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new UpstreamError("invalid_response", `${path}: unexpected response shape`, undefined, {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/** Runs `task` for each item with at most `limit` in flight; results keep input order. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Reads every page of a paginated list endpoint and returns the concatenated
 * `data` items in page order. Items are returned unvalidated; callers parse
 * them with their service-specific schema.
 */
export async function upstreamGetAllPages(
  path: string,
  params: QueryParams = {},
  options: PagedRequestOptions = {},
): Promise<unknown[]> {
  const {
    pageSize = MAX_PAGE_SIZE,
    maxPages = DEFAULTS.maxPages,
    concurrency = DEFAULTS.concurrency,
    signal,
    ...requestOptions
  } = options;

  // One failed page cancels the rest instead of letting them run to completion.
  const controller = new AbortController();
  const linked = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const fetchPage = async (page: number) => {
    const body = await upstreamGet(
      path,
      { ...params, page, page_size: pageSize },
      { ...requestOptions, signal: linked },
    );
    return parseEnvelope(body, path);
  };

  try {
    const first = await fetchPage(1);
    const totalPages = first.pagination.total_pages;
    if (totalPages > maxPages) {
      throw new UpstreamError(
        "too_large",
        `${path}: result spans ${totalPages} pages of ${pageSize} (limit ${maxPages}); narrow the request`,
      );
    }

    const rest = await mapWithConcurrency(
      Array.from({ length: totalPages - 1 }, (_, i) => i + 2),
      concurrency,
      async (page) => {
        const envelope = await fetchPage(page);
        if (envelope.pagination.total_pages !== totalPages) {
          throw new UpstreamError("invalid_response", `${path}: pagination changed while reading`);
        }
        return envelope.data;
      },
    );

    const items: unknown[] = [];
    for (const pageItems of [first.data, ...rest]) {
      for (const item of pageItems) items.push(item);
    }
    return items;
  } catch (error) {
    controller.abort(error);
    throw error;
  }
}
