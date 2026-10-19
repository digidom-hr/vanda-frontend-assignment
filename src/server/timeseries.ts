import "server-only";
import { z } from "zod";
import { isIsoDate } from "@/lib/time";
import type { TimeseriesResponse } from "@/services/api-types";
import type { ServiceId } from "@/services/registry";
import type { Frequency, SeriesColumns, SeriesMeta } from "@/services/types";
import { ADAPTERS } from "./adapters";
import type { CatalogCache } from "./catalog";
import { RequestError } from "./http";
import { upstreamGetAllPages } from "./upstream";

/** Most series one request may ask for. */
export const MAX_SERIES_PER_REQUEST = 20;

/**
 * Most numbers (timestamps plus field values) one response may carry. Keeps
 * JSON responses around 3 MB, under serverless response limits (4.5 MB on
 * Vercel) and comfortable for the browser to parse.
 */
export const MAX_POINTS_PER_RESPONSE = 400_000;

const list = z.string().transform((s) => [
  ...new Set(
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  ),
]);

const dateParam = z.string().refine(isIsoDate, "must be a YYYY-MM-DD date");

const querySchema = z
  .object({
    ids: list.refine((ids) => ids.length > 0, "is required"),
    frequency: z.string().optional(),
    from: dateParam.optional(),
    to: dateParam.optional(),
    fields: list.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "must not be after `to`", path: ["from"] });

export type TimeseriesQuery = z.infer<typeof querySchema>;

function parseQuery(params: URLSearchParams): TimeseriesQuery {
  const result = querySchema.safeParse(Object.fromEntries(params));
  if (!result.success) {
    const issue = result.error.issues[0];
    const name = issue?.path.join(".") || "query";
    throw new RequestError(400, "bad_request", `\`${name}\` ${issue?.message ?? "is invalid"}`);
  }
  return result.data;
}

function resolveSeries(catalog: readonly SeriesMeta[], ids: readonly string[]): SeriesMeta[] {
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const unknown = ids.filter((id) => !byId.has(id));
  if (unknown.length) throw new RequestError(404, "not_found", `Unknown series: ${unknown.join(", ")}`);
  return ids.map((id) => byId.get(id) as SeriesMeta);
}

/** The requested frequency, or the first series' default; every series must have it. */
function resolveFrequency(series: readonly SeriesMeta[], requested: string | undefined): Frequency {
  const frequency = (requested ?? series[0]?.frequencies[0]) as Frequency;
  for (const s of series) {
    if (!s.frequencies.includes(frequency)) {
      throw new RequestError(
        400,
        "bad_request",
        `${s.id} has no ${frequency} data (available: ${s.frequencies.join(", ")})`,
      );
    }
  }
  return frequency;
}

/** The requested fields, or every field the series have; all must exist on at least one series. */
function resolveFields(series: readonly SeriesMeta[], requested: readonly string[] | undefined): readonly string[] {
  const available = [...new Set(series.flatMap((s) => s.fields))];
  if (!requested) return available;
  const unknown = requested.filter((f) => !available.includes(f));
  if (unknown.length) {
    throw new RequestError(
      400,
      "bad_request",
      `Unknown fields: ${unknown.join(", ")} (available: ${available.join(", ")})`,
    );
  }
  return requested;
}

function pick(columns: SeriesColumns | undefined, seriesId: string, fields: readonly string[]): SeriesColumns {
  const t = columns?.t ?? [];
  return {
    seriesId,
    t,
    fields: Object.fromEntries(fields.map((f) => [f, columns?.fields[f] ?? t.map(() => null)])),
  };
}

/**
 * Validates a timeseries request against the service catalog, fetches every
 * upstream page, and returns the requested fields as columns.
 */
export async function getTimeseries(
  service: ServiceId,
  params: URLSearchParams,
  catalog: CatalogCache,
  signal?: AbortSignal,
): Promise<TimeseriesResponse> {
  const query = parseQuery(params);
  if (query.ids.length > MAX_SERIES_PER_REQUEST) {
    throw new RequestError(400, "bad_request", `At most ${MAX_SERIES_PER_REQUEST} series per request`);
  }

  const series = resolveSeries(await catalog.get(service), query.ids);
  const frequency = resolveFrequency(series, query.frequency);
  const fields = resolveFields(series, query.fields);

  const rows = await upstreamGetAllPages(
    `${service}/timeseries`,
    { series_ids: query.ids, frequency, start_date: query.from, end_date: query.to },
    { signal },
  );
  const byId = new Map(ADAPTERS[service].toColumns(rows, frequency).map((c) => [c.seriesId, c]));
  const result = query.ids.map((id) => pick(byId.get(id), id, fields));

  const points = result.reduce((sum, s) => sum + s.t.length * (1 + fields.length), 0);
  if (points > MAX_POINTS_PER_RESPONSE) {
    throw new RequestError(
      413,
      "too_large",
      `This request returns ${points.toLocaleString("en-US")} values (limit ${MAX_POINTS_PER_RESPONSE.toLocaleString("en-US")}). Choose a shorter date range, fewer series or fewer fields.`,
    );
  }

  return { service, frequency, from: query.from ?? null, to: query.to ?? null, series: result };
}
