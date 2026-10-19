const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;

/**
 * Parses an upstream timestamp to epoch milliseconds (UTC).
 * Accepts calendar dates (`2025-03-03`, read as UTC midnight) and UTC
 * date-times (`2025-03-03T14:30:00Z`). Returns null for anything else,
 * including impossible dates such as `2025-02-30`.
 */
export function parseTimestamp(ts: string): number | null {
  const date = DATE.exec(ts);
  if (date) {
    const [, y, m, d] = date.map(Number) as [number, number, number, number];
    const ms = Date.UTC(y, m - 1, d);
    const check = new Date(ms);
    return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? ms : null;
  }
  if (DATETIME_UTC.test(ts)) {
    const ms = Date.parse(ts);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** Formats epoch milliseconds as the API's `YYYY-MM-DD` date (UTC). */
export function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** True for a valid `YYYY-MM-DD` calendar date. */
export function isIsoDate(value: string): boolean {
  return DATE.test(value) && parseTimestamp(value) !== null;
}
