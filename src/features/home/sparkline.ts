export interface SparklinePaths {
  /** The line, for a stroke. */
  readonly line: string;
  /** The line closed down to the bottom edge, for a fill. */
  readonly area: string;
}

const PAD = 2;

/**
 * SVG path data for a small line chart in a `width` × `height` box: x from
 * time, y from value (min at the bottom). Missing values are skipped: a
 * sparkline is a shape, not a reading. Long series are reduced to about
 * `maxPoints` by keeping each bucket's lowest and highest value, in time
 * order, so spikes survive. Null when there are fewer than two values.
 */
export function sparklinePaths(
  t: readonly number[],
  values: readonly (number | null)[],
  width: number,
  height: number,
  maxPoints = 240,
): SparklinePaths | null {
  const points: [number, number][] = [];
  for (let i = 0; i < t.length; i++) {
    const v = values[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) points.push([t[i] as number, v]);
  }
  if (points.length < 2) return null;

  const reduced = points.length > maxPoints ? reduce(points, Math.max(1, Math.floor(maxPoints / 2))) : points;

  let lo = Infinity;
  let hi = -Infinity;
  for (const [, v] of reduced) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const t0 = (reduced[0] as [number, number])[0];
  const tSpan = (reduced[reduced.length - 1] as [number, number])[0] - t0 || 1;
  const vSpan = hi - lo || 1;
  const x = (time: number) => ((time - t0) / tSpan) * width;
  const y = (v: number) => height - PAD - ((v - lo) / vSpan) * (height - 2 * PAD);

  const line = reduced.map(([time, v], i) => `${i ? "L" : "M"}${x(time).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${width},${height}L0,${height}Z`;
  return { line, area };
}

/** Min and max of each of `buckets` equal slices, in the order they occur. */
function reduce(points: readonly [number, number][], buckets: number): [number, number][] {
  const size = Math.ceil(points.length / buckets);
  const out: [number, number][] = [];
  for (let start = 0; start < points.length; start += size) {
    const slice = points.slice(start, start + size);
    let min = slice[0] as [number, number];
    let max = min;
    for (const p of slice) {
      if (p[1] < min[1]) min = p;
      if (p[1] > max[1]) max = p;
    }
    if (min === max) out.push(min);
    else out.push(...(min[0] < max[0] ? [min, max] : [max, min]));
  }
  return out;
}
