// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SeriesMeta } from "@/services/types";
import { createCatalogCache } from "./catalog";
import { UpstreamError } from "./errors";
import { RequestError } from "./http";
import { searchAllServices } from "./search";

const meta = (service: string, id: string, name: string): SeriesMeta => ({
  service,
  id,
  name,
  facets: [],
  frequencies: ["daily"],
  unit: "x",
  fields: ["value"],
});

const CATALOGS: Record<string, SeriesMeta[]> = {
  alpha: [meta("alpha", "A-1", "Acme Corp"), meta("alpha", "A-2", "Acme Industries")],
  bravo: [meta("bravo", "B-1", "Europe Retail Activity")],
  charlie: [meta("charlie", "C-1", "Acme Corp Composite")],
};

const cacheWith = (down: string[] = []) =>
  createCatalogCache({
    load: async (service) => {
      if (down.includes(service)) throw new UpstreamError("unavailable", `${service} down`);
      return CATALOGS[service] ?? [];
    },
  });

const search = (query: string, down?: string[]) => searchAllServices(new URLSearchParams(query), cacheWith(down));

describe("searchAllServices", () => {
  it("merges every service into one ranked list", async () => {
    const res = await search("q=acme");
    expect(res.results.map((r) => [r.service, r.id, r.match])).toEqual([
      ["alpha", "A-1", "name_prefix"],
      ["charlie", "C-1", "name_prefix"],
      ["alpha", "A-2", "name_prefix"],
    ]);
    expect(res.total).toBe(3);
    expect(res.services.every((s) => s.status === "ok")).toBe(true);
  });

  it("applies the limit but reports the full total", async () => {
    const res = await search("q=acme&limit=1");
    expect(res.results).toHaveLength(1);
    expect(res.total).toBe(3);
  });

  it("returns an empty result for an empty query", async () => {
    const res = await search("q=%20%20");
    expect([res.query, res.total, res.results]).toEqual(["", 0, []]);
  });

  it("still searches the remaining services when one is down", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await search("q=acme", ["charlie"]);
    expect(res.results.map((r) => r.id)).toEqual(["A-1", "A-2"]);
    expect(res.services).toContainEqual({ service: "charlie", status: "unavailable" });
  });

  it("fails as unavailable when every service is down", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = await search("q=acme", ["alpha", "bravo", "charlie"]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).kind).toBe("unavailable");
  });

  it.each(["limit=0", "limit=51", "limit=abc", `q=${"x".repeat(101)}`])("rejects %s", async (query) => {
    await expect(search(query)).rejects.toBeInstanceOf(RequestError);
  });
});
