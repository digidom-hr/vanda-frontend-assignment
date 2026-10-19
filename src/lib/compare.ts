/**
 * Rebasing for comparisons: each series becomes an index that starts at 100
 * at the first value inside the visible range, so instruments of different
 * size can share one axis (no second y-axis) and the chart shows relative
 * performance.
 */
export function rebaseTo100(t: readonly number[], values: readonly (number | null)[], from: number): (number | null)[] {
  let base: number | null = null;
  for (let i = 0; i < t.length; i++) {
    const v = values[i];
    if ((t[i] as number) >= from && v !== null && v !== undefined && v !== 0) {
      base = v;
      break;
    }
  }
  if (base === null) return values.map(() => null);
  const b = base;
  return values.map((v) => (v === null || v === undefined ? null : (v / b) * 100));
}
