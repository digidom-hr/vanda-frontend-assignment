import "server-only";
import { z } from "zod";
import { parseTimestamp } from "@/lib/time";
import type { Frequency, SeriesColumns, SeriesMeta } from "@/services/types";
import { UpstreamError } from "./errors";

/** Server-side half of a data service: validates upstream payloads and normalises them. */
export interface ServiceAdapter {
  /** Validates `/series` items and maps them to the shared catalog shape. */
  parseSeries(items: readonly unknown[]): SeriesMeta[];
  /** Validates `/timeseries` rows and pivots them into one column set per series. */
  toColumns(rows: readonly unknown[], frequency: Frequency): SeriesColumns[];
}

/** Parses with `schema`, turning a mismatch into an `invalid_response` error that names the bad path. */
export function parseUpstream<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
  throw new UpstreamError("invalid_response", `${what}: ${issue?.message ?? "invalid"}${where}`, undefined, {
    cause: result.error,
  });
}

/** Upstream timestamp, converted to epoch milliseconds (UTC). */
export const timestampSchema = z.string().transform((ts, ctx) => {
  const ms = parseTimestamp(ts);
  if (ms === null) {
    ctx.addIssue({ code: "custom", message: `invalid timestamp "${ts}"` });
    return z.NEVER;
  }
  return ms;
});

/** A chartable value. `null` is tolerated so a single missing value becomes a gap, not an error. */
export const valueSchema = z.number().nullable();

/**
 * Keeps the frequencies we know how to serve, in upstream order, so that a
 * frequency added upstream later is ignored rather than rejected.
 */
export function knownFrequencies(values: readonly string[], known: readonly Frequency[]): Frequency[] {
  return values.filter((v): v is Frequency => (known as readonly string[]).includes(v));
}

class SeriesColumnsBuilder {
  private readonly t: number[] = [];
  private readonly fields: Record<string, (number | null)[]> = {};
  private readonly index = new Map<number, number>();

  constructor(
    private readonly seriesId: string,
    private readonly keys: readonly string[],
  ) {
    for (const key of keys) this.fields[key] = [];
  }

  /** Index of timestamp `t`, appending an all-null row the first time it is seen. */
  private rowAt(t: number): number {
    let i = this.index.get(t);
    if (i === undefined) {
      i = this.t.length;
      this.index.set(t, i);
      this.t.push(t);
      for (const key of this.keys) (this.fields[key] as (number | null)[]).push(null);
    }
    return i;
  }

  set(t: number, key: string, value: number | null): void {
    const column = this.fields[key];
    if (column) column[this.rowAt(t)] = value;
  }

  build(): SeriesColumns {
    const n = this.t.length;
    let sorted = true;
    for (let i = 1; i < n && sorted; i++) sorted = (this.t[i - 1] as number) < (this.t[i] as number);
    if (sorted) return { seriesId: this.seriesId, t: this.t, fields: this.fields };

    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => (this.t[a] as number) - (this.t[b] as number));
    const fields: Record<string, (number | null)[]> = {};
    for (const key of this.keys) {
      const column = this.fields[key] as (number | null)[];
      fields[key] = order.map((i) => column[i] as number | null);
    }
    return { seriesId: this.seriesId, t: order.map((i) => this.t[i] as number), fields };
  }
}

/**
 * Accumulates values into aligned columns per series. Works for wide rows
 * (many fields per row) and long rows (one field per row, e.g. bravo's
 * metric rows): repeated timestamps merge into one row, missing values stay
 * null, and output is sorted by time. Series keep first-seen order.
 */
export class ColumnsBuilder {
  private readonly series = new Map<string, SeriesColumnsBuilder>();

  constructor(private readonly keys: readonly string[]) {}

  set(seriesId: string, t: number, key: string, value: number | null): void {
    let builder = this.series.get(seriesId);
    if (!builder) {
      builder = new SeriesColumnsBuilder(seriesId, this.keys);
      this.series.set(seriesId, builder);
    }
    builder.set(t, key, value);
  }

  build(): SeriesColumns[] {
    return [...this.series.values()].map((b) => b.build());
  }
}
