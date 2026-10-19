/**
 * Display text for a raw facet value: "single_name" -> "Single name",
 * "equity" -> "Equity". Values that already have capitals ("North America",
 * "Hedge Funds") are left as the service wrote them.
 */
export function formatFacetValue(value: string): string {
  const spaced = value.replace(/_/g, " ").trim();
  if (spaced !== spaced.toLowerCase()) return spaced;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** Axis labels: compact from 10,000 up (12.5K, 3.4M, 1.2B); small values keep up to 2 decimals. */
export function formatAxisNumber(value: number): string {
  if (Math.abs(value) >= 10_000) return compactFormat.format(value).replace("-", "−");
  return formatNumber(value, Math.abs(value) < 10 && !Number.isInteger(value) ? 2 : 0);
}

/** A number with a fixed count of decimals, grouped, and a true minus sign. */
export function formatNumber(value: number, decimals = 2): string {
  return value
    .toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    .replace("-", "−");
}

/** Units that read as suffixes with no space; everything else gets a space ("12.40 USD"). */
const TIGHT_UNITS = new Set(["%", "σ"]);

/**
 * A value with its unit for tooltips and readouts. Large magnitudes are
 * compacted (−1.2B USD) so flow values stay readable; small ones keep decimals.
 */
export function formatValue(value: number | null | undefined, unit: string, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "No data";
  const number =
    Math.abs(value) >= 1_000_000 ? compactFormat.format(value).replace("-", "−") : formatNumber(value, decimals);
  if (!unit) return number;
  return TIGHT_UNITS.has(unit) ? `${number}${unit}` : `${number} ${unit}`;
}

const DAY_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const MINUTE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** A timestamp as analysts read it: "3 Mar 2025", or "3 Mar 2025, 14:30 UTC" for intraday data. */
export function formatTimestamp(ms: number, intraday = false): string {
  return intraday ? `${MINUTE_FORMAT.format(ms)} UTC` : DAY_FORMAT.format(ms);
}

/** Escapes text for safe insertion into HTML strings (e.g. chart tooltips). */
export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
