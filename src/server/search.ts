import "server-only";
import { z } from "zod";
import { searchCatalogs, type CatalogInput } from "@/lib/search";
import type { SearchResponse, ServiceSearchStatus } from "@/services/api-types";
import { SERVICES } from "@/services/registry";
import type { CatalogCache } from "./catalog";
import { RequestError } from "./http";
import { UpstreamError } from "./errors";

export const MAX_QUERY_LENGTH = 100;
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 50;

const querySchema = z.object({
  q: z.string().max(MAX_QUERY_LENGTH, `must be at most ${MAX_QUERY_LENGTH} characters`).default(""),
  limit: z.coerce.number().int().min(1).max(MAX_SEARCH_LIMIT).default(DEFAULT_SEARCH_LIMIT),
});

/**
 * Searches every registered service's catalog. A service whose catalog cannot
 * be loaded is reported as unavailable and the others are still searched; only
 * when every service is unavailable does the whole search fail.
 */
export async function searchAllServices(params: URLSearchParams, catalog: CatalogCache): Promise<SearchResponse> {
  const parsed = querySchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new RequestError(
      400,
      "bad_request",
      `\`${issue?.path.join(".") || "query"}\` ${issue?.message ?? "is invalid"}`,
    );
  }
  const { q, limit } = parsed.data;
  const query = q.trim();

  const settled = await Promise.allSettled(SERVICES.map((s) => catalog.get(s.id)));
  const catalogs: CatalogInput[] = [];
  const services: ServiceSearchStatus[] = SERVICES.map((s, i) => {
    const result = settled[i];
    if (result?.status === "fulfilled") {
      catalogs.push({ service: s.id, series: result.value });
      return { service: s.id, status: "ok" };
    }
    console.warn(`[search] ${s.id} catalog unavailable:`, result?.reason);
    return { service: s.id, status: "unavailable" };
  });

  if (catalogs.length === 0) {
    throw new UpstreamError("unavailable", "No data service could be searched");
  }

  const hits = searchCatalogs(catalogs, query);
  return {
    query,
    total: hits.length,
    results: hits.slice(0, limit).map(({ series, tier }) => ({
      service: series.service,
      id: series.id,
      name: series.name,
      facets: series.facets,
      frequencies: series.frequencies,
      unit: series.unit,
      match: tier,
    })),
    services,
  };
}
