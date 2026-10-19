/**
 * Failure modes when talking to an upstream data service. Route handlers map
 * these to HTTP responses; the UI uses them to choose an error message.
 */
export type UpstreamErrorKind =
  /** The request did not complete within its time budget. */
  | "timeout"
  /** The service could not be reached (connection refused, DNS, reset). */
  | "unavailable"
  /** The service rejected our parameters (HTTP 400). */
  | "bad_request"
  /** The service does not know the resource (HTTP 404). */
  | "not_found"
  /** The service failed (HTTP 5xx or another unexpected status). */
  | "upstream_error"
  /** The response was not the JSON shape we expect. */
  | "invalid_response"
  /** The result is larger than we are willing to read in one request. */
  | "too_large";

export class UpstreamError extends Error {
  override readonly name = "UpstreamError";

  constructor(
    readonly kind: UpstreamErrorKind,
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }

  /** Transient failures that are worth another attempt. */
  get retryable(): boolean {
    return (
      this.kind === "timeout" ||
      this.kind === "unavailable" ||
      (this.kind === "upstream_error" && (this.status === undefined || this.status >= 500))
    );
  }
}
