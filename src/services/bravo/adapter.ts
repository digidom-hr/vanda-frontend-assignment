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
import { UpstreamError } from "@/server/errors";
import type { SeriesMeta } from "../types";
import { bravoMeta } from "./meta";

const FIELD_KEYS: readonly string[] = bravoMeta.fields.map((f) => f.key);

const seriesSchema = z.object({
  series_id: z.string().min(1),
  name: z.string().min(1),
  region: z.string(),
  category: z.string(),
  metrics: z.array(z.string()),
  frequencies: z.array(z.string()),
  unit: z.string(),
});

// One row per metric per timestamp. Metrics we don't know are skipped.
const rowSchema = z.object({
  ts: timestampSchema,
  series_id: z.string().min(1),
  metric: z.string(),
  frequency: z.string(),
  value: valueSchema,
});

export const bravoAdapter: ServiceAdapter = {
  parseSeries(items) {
    const series = parseUpstream(z.array(seriesSchema), items, "bravo series");
    return series.flatMap((s): SeriesMeta[] => {
      const frequencies = knownFrequencies(s.frequencies, bravoMeta.frequencies);
      const fields = s.metrics.filter((m) => FIELD_KEYS.includes(m));
      if (frequencies.length === 0 || fields.length === 0) return [];
      return [
        {
          service: bravoMeta.id,
          id: s.series_id,
          name: s.name,
          facets: [
            { key: "region", label: "Region", value: s.region },
            { key: "category", label: "Category", value: s.category },
          ],
          frequencies,
          unit: s.unit,
          fields,
        },
      ];
    });
  },

  toColumns(rows, frequency) {
    const parsed = parseUpstream(z.array(rowSchema), rows, "bravo timeseries");
    const builder = new ColumnsBuilder(FIELD_KEYS);
    for (const row of parsed) {
      if (row.frequency !== frequency) {
        throw new UpstreamError(
          "invalid_response",
          `bravo timeseries: asked for ${frequency} rows, got ${row.frequency} (${row.series_id} ${row.metric})`,
        );
      }
      builder.set(row.series_id, row.ts, row.metric, row.value);
    }
    return builder.build();
  },
};
