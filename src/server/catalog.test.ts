// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SeriesMeta } from "@/services/types";
import { createCatalogCache } from "./catalog";

const meta = (id: string): SeriesMeta => ({
  service: "alpha",
  id,
  name: id,
  facets: [],
  frequencies: ["daily"],
  unit: "USD",
  fields: ["price"],
});

function setup() {
  let clock = 0;
  const load = vi.fn<(service: string) => Promise<readonly SeriesMeta[]>>();
  const cache = createCatalogCache({ ttlMs: 1000, now: () => clock, load });
  return { cache, load, advance: (ms: number) => (clock += ms) };
}

describe("createCatalogCache", () => {
  it("serves a fresh catalog from memory", async () => {
    const { cache, load } = setup();
    load.mockResolvedValue([meta("A")]);
    await cache.get("alpha");
    await expect(cache.get("alpha")).resolves.toEqual([meta("A")]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("refetches after the TTL", async () => {
    const { cache, load, advance } = setup();
    load.mockResolvedValueOnce([meta("A")]).mockResolvedValueOnce([meta("B")]);
    await cache.get("alpha");
    advance(1001);
    await expect(cache.get("alpha")).resolves.toEqual([meta("B")]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one fetch between concurrent requests", async () => {
    const { cache, load } = setup();
    load.mockResolvedValue([meta("A")]);
    await Promise.all([cache.get("alpha"), cache.get("alpha"), cache.get("alpha")]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps services separate", async () => {
    const { cache, load } = setup();
    load.mockImplementation(async (service) => [meta(service)]);
    await expect(cache.get("alpha")).resolves.toEqual([meta("alpha")]);
    await expect(cache.get("bravo")).resolves.toEqual([meta("bravo")]);
  });

  it("serves the previous catalog when a refresh fails", async () => {
    const { cache, load, advance } = setup();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    load.mockResolvedValueOnce([meta("A")]).mockRejectedValueOnce(new Error("down"));
    await cache.get("alpha");
    advance(1001);
    await expect(cache.get("alpha")).resolves.toEqual([meta("A")]);
  });

  it("propagates the failure when there is nothing cached, then retries next time", async () => {
    const { cache, load } = setup();
    load.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce([meta("A")]);
    await expect(cache.get("alpha")).rejects.toThrow("down");
    await expect(cache.get("alpha")).resolves.toEqual([meta("A")]);
  });
});
