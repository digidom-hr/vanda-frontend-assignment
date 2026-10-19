import "server-only";
import type { ServiceId } from "@/services/registry";
import type { SeriesMeta } from "@/services/types";
import { ADAPTERS } from "./adapters";
import { upstreamGetAllPages } from "./upstream";

/** How long a fetched catalog is considered fresh. */
export const CATALOG_TTL_MS = 5 * 60_000;

interface Entry {
  value?: readonly SeriesMeta[];
  fetchedAt: number;
  pending?: Promise<readonly SeriesMeta[]>;
}

export interface CatalogCache {
  get(service: ServiceId): Promise<readonly SeriesMeta[]>;
}

export interface CatalogCacheOptions {
  ttlMs?: number;
  now?: () => number;
  load?: (service: ServiceId) => Promise<readonly SeriesMeta[]>;
}

async function loadCatalog(service: ServiceId): Promise<readonly SeriesMeta[]> {
  const items = await upstreamGetAllPages(`${service}/series`);
  return ADAPTERS[service].parseSeries(items);
}

/**
 * In-memory catalog cache, per server instance.
 *
 * - Fresh entries are served from memory.
 * - Concurrent requests for the same service share one upstream fetch.
 * - If a refresh fails and an older catalog exists, the older one is served,
 *   so a briefly unavailable service does not break search or navigation.
 *
 * Catalogs are small (tens of series) and change rarely, so a per-instance
 * cache is enough; the CDN caches the HTTP responses on top of this.
 */
export function createCatalogCache(options: CatalogCacheOptions = {}): CatalogCache {
  const { ttlMs = CATALOG_TTL_MS, now = Date.now, load = loadCatalog } = options;
  const entries = new Map<ServiceId, Entry>();

  return {
    get(service) {
      const entry = entries.get(service) ?? { fetchedAt: 0 };
      entries.set(service, entry);
      if (entry.value && now() - entry.fetchedAt < ttlMs) return Promise.resolve(entry.value);
      if (entry.pending) return entry.pending;

      entry.pending = load(service)
        .then((value) => {
          entry.value = value;
          entry.fetchedAt = now();
          return value;
        })
        .catch((error: unknown) => {
          if (entry.value) {
            console.warn(`[catalog] ${service}: refresh failed, serving cached catalog`, error);
            return entry.value;
          }
          throw error;
        })
        .finally(() => {
          entry.pending = undefined;
        });
      return entry.pending;
    },
  };
}

export const catalogCache = createCatalogCache();
