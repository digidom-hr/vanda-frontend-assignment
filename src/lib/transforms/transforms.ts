/**
 * Pure series transforms. Inputs and outputs are value arrays aligned 1:1 with
 * the series' timestamps. `null` means "no value" (a gap in the chart): it is
 * produced for warm-up periods and undefined results, and never replaced by 0.
 *
 * Every transform is a single O(n) pass, so they are cheap enough to run on
 * every parameter change in the browser, even for ~100k-point intraday series.
 */

export type Values = readonly (number | null)[];
export type Output = (number | null)[];

function assertWindow(name: string, window: number): void {
  if (!Number.isInteger(window) || window < 1) {
    throw new RangeError(`${name} must be a positive integer, got ${window}`);
  }
}

const FLAT_TOLERANCE = 1e-12;

const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Sum over the trailing `window` points, including the current one. A result
 * needs a full window of values; any gap inside the window yields null.
 */
export function rollingSum(values: Values, window: number): Output {
  assertWindow("window", window);
  const out: Output = new Array<number | null>(values.length).fill(null);
  let sum = 0;
  let gaps = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (isNum(v)) sum += v;
    else gaps++;
    if (i >= window) {
      const old = values[i - window];
      if (isNum(old)) sum -= old;
      else gaps--;
    }
    if (i >= window - 1 && gaps === 0) out[i] = sum;
  }
  return out;
}

/** Simple (equal-weight) moving average over the trailing `window` points. */
export function movingAverage(values: Values, window: number): Output {
  return rollingSum(values, window).map((s) => (s === null ? null : s / window));
}

/**
 * Percent change versus `periods` points earlier, in percent.
 *
 * Uses `(x - prev) / |prev|` so the sign always reflects the direction of the
 * move, even when the base is negative (e.g. net flows). A zero or missing
 * base yields null rather than ±Infinity.
 */
export function pctChange(values: Values, periods = 1): Output {
  assertWindow("periods", periods);
  const out: Output = new Array<number | null>(values.length).fill(null);
  for (let i = periods; i < values.length; i++) {
    const v = values[i];
    const prev = values[i - periods];
    if (isNum(v) && isNum(prev) && prev !== 0) out[i] = ((v - prev) / Math.abs(prev)) * 100;
  }
  return out;
}

/**
 * Running total. Gaps contribute nothing and stay gaps in the output; the
 * total carries across them.
 */
export function cumulative(values: Values): Output {
  const out: Output = new Array<number | null>(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (isNum(v)) {
      sum += v;
      out[i] = sum;
    }
  }
  return out;
}

/** Mean of the non-null values, or null when there are none. */
function meanOf(values: Values): number | null {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (isNum(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? null : sum / n;
}

/**
 * Standard score: how many (sample) standard deviations each value is from
 * the mean.
 *
 * - Without `window`, mean and deviation come from the whole series.
 * - With `window`, they come from the trailing window ending at each point
 *   (a full, gap-free window is required).
 *
 * A constant series (zero deviation) has no meaningful score and yields null.
 * Values are centred on the series mean before squaring so that large
 * magnitudes (~1e11) do not lose precision.
 */
export function zScore(values: Values, window?: number): Output {
  const out: Output = new Array<number | null>(values.length).fill(null);
  const shift = meanOf(values);
  if (shift === null) return out;

  if (window === undefined) {
    let sumSq = 0;
    let n = 0;
    for (const v of values) {
      if (isNum(v)) {
        sumSq += (v - shift) ** 2;
        n++;
      }
    }
    if (n < 2) return out;
    const sd = Math.sqrt(sumSq / (n - 1));
    if (sd === 0) return out;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (isNum(v)) out[i] = (v - shift) / sd;
    }
    return out;
  }

  assertWindow("window", window);
  if (window < 2) return out;
  let sum = 0;
  let sumSq = 0;
  let gaps = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (isNum(v)) {
      const d = v - shift;
      sum += d;
      sumSq += d * d;
    } else gaps++;
    if (i >= window) {
      const old = values[i - window];
      if (isNum(old)) {
        const d = old - shift;
        sum -= d;
        sumSq -= d * d;
      } else gaps--;
    }
    if (i >= window - 1 && gaps === 0 && isNum(v)) {
      const mean = sum / window;
      const variance = (sumSq - sum * mean) / (window - 1);
      // Running sums leave rounding residue; a variance that is tiny relative
      // to the window's magnitude is a flat window, not a real deviation.
      if (variance > FLAT_TOLERANCE * (sumSq / window)) {
        out[i] = (v - shift - mean) / Math.sqrt(variance);
      }
    }
  }
  return out;
}
