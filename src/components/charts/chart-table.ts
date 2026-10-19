/**
 * The table view of a chart: the same data as rows, so values are readable
 * without colour, hover or a pointer (screen readers, low-contrast colours,
 * copying exact numbers). Rows are limited to the visible range, newest first.
 */
import { formatNumber, formatTimestamp } from "@/lib/format";
import type { ChartSpec } from "./chart-options";

export const MAX_TABLE_ROWS = 500;

export interface TableColumn {
  readonly key: string;
  readonly label: string;
  readonly numeric: boolean;
}

export interface TableData {
  readonly caption: string;
  readonly columns: readonly TableColumn[];
  /** Pre-formatted cells; null means no value. */
  readonly rows: readonly { readonly key: string; readonly cells: readonly (string | null)[] }[];
  /** Explains a cap on the rows shown, when there is one. */
  readonly note?: string;
}

function decimalsFor(value: number, explicit: number | undefined): number {
  if (explicit !== undefined) return explicit;
  return Math.abs(value) >= 1000 ? 0 : 2;
}

export function chartTable(spec: ChartSpec): TableData {
  const inRange = (t: number) => !spec.range || (t >= spec.range.min && t <= spec.range.max);

  const byTime = new Map<number, (number | null)[]>();
  spec.series.forEach((series, column) => {
    series.t.forEach((t, i) => {
      if (!inRange(t)) return;
      let row = byTime.get(t);
      if (!row) {
        row = spec.series.map(() => null);
        byTime.set(t, row);
      }
      row[column] = series.values[i] ?? null;
    });
  });

  const times = [...byTime.keys()].sort((a, b) => b - a);
  const shown = times.slice(0, MAX_TABLE_ROWS);
  const unit = spec.unit ? ` (${spec.unit})` : "";

  return {
    caption: `${spec.title}${unit}`,
    columns: [
      { key: "date", label: spec.intraday ? "Time (UTC)" : "Date", numeric: false },
      ...spec.series.map((s) => ({ key: s.id, label: s.name, numeric: true })),
    ],
    rows: shown.map((t) => ({
      key: String(t),
      cells: [
        formatTimestamp(t, spec.intraday),
        ...(byTime.get(t) ?? []).map((v) => (v === null ? null : formatNumber(v, decimalsFor(v, spec.decimals)))),
      ],
    })),
    note:
      times.length > MAX_TABLE_ROWS
        ? `Showing the latest ${MAX_TABLE_ROWS.toLocaleString("en-US")} of ${times.length.toLocaleString("en-US")} rows in this range. Narrow the range to see earlier rows.`
        : undefined,
  };
}
