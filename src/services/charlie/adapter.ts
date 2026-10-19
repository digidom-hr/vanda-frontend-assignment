import "server-only";
import { z } from "zod";
import {
  ColumnsBuilder,
  knownFrequencies,
  parseUpstream,
  timestampSchema,
  valueSchema,
  type ServiceAdapter,
} from "@/server/adapter-kit";
import type { SeriesMeta } from "../types";
import { charlieMeta, type CharlieSignal } from "./meta";

const seriesSchema = z.object({
  series_id: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  frequencies: z.array(z.string()),
  unit: z.string(),
});

const rowSchema = z.object({
  ts: timestampSchema,
  series_id: z.string().min(1),
  value: valueSchema,
});

const latestSchema = z.object({
  series_id: z.string().min(1),
  name: z.string().min(1),
  category: z.string(),
  ts: timestampSchema,
  value: z.number(),
  unit: z.string(),
  signal: z.enum(["high", "mid", "low"]),
});

/** Latest value of a charlie series, with the service's signal classification. */
export interface CharlieLatest {
  readonly seriesId: string;
  readonly name: string;
  readonly category: string;
  readonly t: number;
  readonly value: number;
  readonly unit: string;
  readonly signal: CharlieSignal;
}

export const charlieAdapter: ServiceAdapter = {
  parseSeries(items) {
    const series = parseUpstream(z.array(seriesSchema), items, "charlie series");
    return series.flatMap((s): SeriesMeta[] => {
      const frequencies = knownFrequencies(s.frequencies, charlieMeta.frequencies);
      if (frequencies.length === 0) return [];
      return [
        {
          service: charlieMeta.id,
          id: s.series_id,
          name: s.name,
          facets: [{ key: "category", label: "Category", value: s.category }],
          frequencies,
          unit: s.unit,
          fields: ["value"],
        },
      ];
    });
  },

  toColumns(rows) {
    const parsed = parseUpstream(z.array(rowSchema), rows, "charlie timeseries");
    const builder = new ColumnsBuilder(["value"]);
    for (const row of parsed) builder.set(row.series_id, row.ts, "value", row.value);
    return builder.build();
  },
};

export function parseCharlieLatest(items: readonly unknown[]): CharlieLatest[] {
  return parseUpstream(z.array(latestSchema), items, "charlie latest").map((l) => ({
    seriesId: l.series_id,
    name: l.name,
    category: l.category,
    t: l.ts,
    value: l.value,
    unit: l.unit,
    signal: l.signal,
  }));
}
