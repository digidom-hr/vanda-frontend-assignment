/**
 * Cross-service series search with one matching rule and one ranking for every
 * service. The upstream services each search and sort differently (substring
 * vs word-prefix, AND vs OR, alphabetical vs by latest value), so results from
 * them cannot be merged meaningfully; instead we search the catalogs here.
 *
 * Matching: every query word must be the start of a word in the series' name
 * or facet values (case-, punctuation- and accent-insensitive), or the
 * query as a whole must be a prefix of the series id ("a0001", "A-00").
 *
 * Ranking (best first):
 *   1. exact id                     "A-0001"
 *   2. id prefix                    "A-00"
 *   3. name starts with the query   "north am"  -> North America ...
 *   4. every word matches the name  "acme corp"
 *   5. some words only match facets "technology" -> companies in that sector
 * Within a tier: id prefixes in id order; otherwise more whole-word matches
 * first, then name A-Z, then service order. Sorting by name keeps one entity's series from different services
 * together (e.g. "Acme Corp (ACMC)" next to "Acme Corp Composite").
 */
import type { SeriesMeta } from "@/services/types";

export type MatchTier = "id" | "id_prefix" | "name_prefix" | "name" | "facet";

const TIER_SCORE: Record<MatchTier, number> = { id: 5, id_prefix: 4, name_prefix: 3, name: 2, facet: 1 };

export interface SearchHit {
  readonly series: SeriesMeta;
  readonly tier: MatchTier;
}

/** Lowercase, accent-free words of `text`. */
export function words(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const compact = (text: string) => words(text).join("");

interface Indexed {
  readonly series: SeriesMeta;
  readonly id: string;
  readonly name: readonly string[];
  /** Facet words. Ids are matched only as a whole, never by fragment. */
  readonly facets: readonly string[];
}

// Catalog arrays are cached and reused, so their search index can be too.
const indexCache = new WeakMap<readonly SeriesMeta[], readonly Indexed[]>();

function indexCatalog(catalog: readonly SeriesMeta[]): readonly Indexed[] {
  let index = indexCache.get(catalog);
  if (!index) {
    index = catalog.map((series) => ({
      series,
      id: compact(series.id),
      name: words(series.name),
      facets: series.facets.flatMap((f) => words(f.value)),
    }));
    indexCache.set(catalog, index);
  }
  return index;
}

interface Scored extends SearchHit {
  readonly score: number;
  readonly exactWords: number;
  readonly order: number;
}

function score(entry: Indexed, tokens: readonly string[], query: string): Omit<Scored, "order"> | null {
  if (entry.id === query) return { series: entry.series, tier: "id", score: TIER_SCORE.id, exactWords: tokens.length };
  if (query.length >= 2 && entry.id.startsWith(query)) {
    return { series: entry.series, tier: "id_prefix", score: TIER_SCORE.id_prefix, exactWords: 0 };
  }

  let inName = 0;
  let exactWords = 0;
  for (const token of tokens) {
    const nameWord = entry.name.find((w) => w.startsWith(token));
    if (nameWord !== undefined) {
      inName++;
      if (entry.name.includes(token)) exactWords++;
      continue;
    }
    if (!entry.facets.some((w) => w.startsWith(token))) return null;
    if (entry.facets.includes(token)) exactWords++;
  }

  let tier: MatchTier = "facet";
  if (inName === tokens.length) {
    const prefix = tokens.every((token, i) =>
      i === tokens.length - 1 ? (entry.name[i] ?? "").startsWith(token) : entry.name[i] === token,
    );
    tier = prefix ? "name_prefix" : "name";
  }
  return { series: entry.series, tier, score: TIER_SCORE[tier], exactWords };
}

export interface CatalogInput {
  readonly service: string;
  readonly series: readonly SeriesMeta[];
}

/** All matches across `catalogs` (given in service order), best first. */
export function searchCatalogs(catalogs: readonly CatalogInput[], rawQuery: string): SearchHit[] {
  const tokens = words(rawQuery);
  if (tokens.length === 0) return [];
  const query = tokens.join("");

  const scored: Scored[] = [];
  catalogs.forEach((catalog, order) => {
    for (const entry of indexCatalog(catalog.series)) {
      const hit = score(entry, tokens, query);
      if (hit) scored.push({ ...hit, order });
    }
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      // Someone typing an id prefix is scanning by id, so keep that tier in id order.
      (a.tier === "id_prefix" ? a.series.id.localeCompare(b.series.id) : 0) ||
      b.exactWords - a.exactWords ||
      a.series.name.localeCompare(b.series.name, "en", { sensitivity: "base" }) ||
      a.order - b.order ||
      a.series.id.localeCompare(b.series.id),
  );
  return scored.map(({ series, tier }) => ({ series, tier }));
}
