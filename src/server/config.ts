import "server-only";

const DEFAULT_MOCK_API_URL = "http://localhost:4000";

/**
 * Base URL of the mock API, without a trailing slash. Read per call so tests
 * and deployments can override it via the `MOCK_API_URL` environment variable.
 */
export function mockApiBaseUrl(): string {
  const raw = process.env.MOCK_API_URL?.trim() || DEFAULT_MOCK_API_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`MOCK_API_URL is not a valid URL: "${raw}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`MOCK_API_URL must use http or https: "${raw}"`);
  }
  return url.href.replace(/\/+$/, "");
}
