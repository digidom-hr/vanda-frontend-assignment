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
import { alphaMeta } from "./meta";

const FIELD_KEYS = alphaMeta.fields.map((f) => f.key);

const seriesSchema = z.object({
  series_id: z.string().min(1),
  name: z.string().min(1),
  group: z.string(),
  frequencies: z.array(z.string()),
  unit: z.string(),
});

type FieldKey = (typeof FIELD_KEYS)[number];

const valueShape = Object.fromEntries(FIELD_KEYS.map((key) => [key, valueSchema])) as Record<
  FieldKey,
  typeof valueSchema
>;

const rowSchema = z.object({
  ts: timestampSchema,
  series_id: z.string().min(1),
  ...valueShape,
});

export const alphaAdapter: ServiceAdapter = {
  parseSeries(items) {
    const series = parseUpstream(z.array(seriesSchema), items, "alpha series");
    return series.flatMap((s): SeriesMeta[] => {
      const frequencies = knownFrequencies(s.frequencies, alphaMeta.frequencies);
      if (frequencies.length === 0) return [];
      return [
        {
          service: alphaMeta.id,
          id: s.series_id,
          name: s.name,
          facets: [{ key: "group", label: "Sector", value: s.group }],
          frequencies,
          unit: s.unit,
          fields: FIELD_KEYS,
        },
      ];
    });
  },

  toColumns(rows) {
    const parsed = parseUpstream(z.array(rowSchema), rows, "alpha timeseries");
    const builder = new ColumnsBuilder(FIELD_KEYS);
    for (const row of parsed) {
      for (const key of FIELD_KEYS) builder.set(row.series_id, row.ts, key, row[key]);
    }
    return builder.build();
  },
};
