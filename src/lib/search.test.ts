import { describe, expect, it } from "vitest";
import type { Facet, SeriesMeta } from "@/services/types";
import { matchesQuery, searchCatalogs, words, type CatalogInput } from "./search";

const s = (service: string, id: string, name: string, facets: [string, string][] = []): SeriesMeta => ({
  service,
  id,
  name,
  facets: facets.map(([key, value]): Facet => ({ key, label: key, value })),
  frequencies: ["daily"],
  unit: "x",
  fields: ["value"],
});

// Real names from the three catalogs, including the cases the upstream services handle inconsistently.
const CATALOGS: CatalogInput[] = [
  {
    service: "alpha",
    series: [
      s("alpha", "A-0001", "Acme Corp (ACMC)", [["group", "Technology"]]),
      s("alpha", "A-0002", "Acme Industries (ACMI)", [["group", "Industrials"]]),
      s("alpha", "A-0004", "Cascade Energy (CASE)", [["group", "Energy"]]),
      s("alpha", "A-0013", "Lumen Technologies (LUMT)", [["group", "Technology"]]),
      s("alpha", "A-0015", "Northwind Logistics (NORL)", [["group", "Industrials"]]),
      s("alpha", "A-0023", "Vertex Biotech (VERB)", [["group", "Healthcare"]]),
    ],
  },
  {
    service: "bravo",
    series: [
      s("bravo", "B-0101", "North America Retail Activity", [
        ["region", "North America"],
        ["category", "Retail"],
      ]),
      s("bravo", "B-0131", "Technology Sector Activity", [
        ["region", "Global"],
        ["category", "Technology"],
      ]),
      s("bravo", "B-0132", "Energy Sector Activity", [
        ["region", "Global"],
        ["category", "Energy"],
      ]),
    ],
  },
  {
    service: "charlie",
    series: [
      s("charlie", "C-0001", "North America Equity Composite", [["category", "equity"]]),
      s("charlie", "C-0011", "Japan Equity Composite", [["category", "equity"]]),
      s("charlie", "C-0016", "Asia ex-Japan Equity Composite", [["category", "equity"]]),
      s("charlie", "C-0031", "Technology Composite", [["category", "sector"]]),
      s("charlie", "C-0032", "Energy Composite", [["category", "sector"]]),
      s("charlie", "C-0039", "Acme Corp Composite", [["category", "single_name"]]),
      s("charlie", "C-0040", "ACME INDUSTRIES Composite", [["category", "single_name"]]),
      s("charlie", "C-0042", "Cascade Energy Composite", [["category", "single_name"]]),
    ],
  },
];

const ids = (q: string) => searchCatalogs(CATALOGS, q).map((h) => h.series.id);

describe("words", () => {
  it("lowercases, strips accents and splits on punctuation", () => {
    expect(words("  Société-Générale (SOGN) ")).toEqual(["societe", "generale", "sogn"]);
    expect(words("Asia ex-Japan")).toEqual(["asia", "ex", "japan"]);
  });
});

describe("searchCatalogs", () => {
  it("returns nothing for an empty or punctuation-only query", () => {
    expect(ids("")).toEqual([]);
    expect(ids(" - ")).toEqual([]);
  });

  it("finds an exact id in any service, ignoring case and punctuation", () => {
    expect(ids("a-0001")[0]).toBe("A-0001");
    expect(ids("B0101")[0]).toBe("B-0101");
    expect(ids("c-0039")[0]).toBe("C-0039");
  });

  it("does not drown an id lookup in noise (charlie's upstream returns 17 hits for 'a-0001')", () => {
    expect(ids("a-0001")).toEqual(["A-0001"]);
  });

  it("does not match fragments of ids from other series", () => {
    // "0001" is part of A-0001 and C-0001, but neither id starts with it.
    expect(ids("0001")).toEqual([]);
  });

  it("matches id prefixes, in id order", () => {
    expect(ids("C-004")).toEqual(["C-0040", "C-0042"]);
    expect(ids("c-00")).toEqual(["C-0001", "C-0011", "C-0016", "C-0031", "C-0032", "C-0039", "C-0040", "C-0042"]);
  });

  it("requires every word to match (charlie's upstream ORs words)", () => {
    // 'north eq' must not return Japan or Asia equity composites.
    expect(ids("north eq")).toEqual(["C-0001"]);
  });

  it("matches word prefixes, not arbitrary substrings (alpha's upstream matches 'Biotech' for 'tech')", () => {
    expect(ids("tech")).not.toContain("A-0023");
  });

  it("ranks names that start with the query above other name matches", () => {
    const hits = searchCatalogs(CATALOGS, "north");
    expect(hits.map((h) => [h.series.id, h.tier])).toEqual([
      // Whole word "north", then name A-Z: "...America Equity" before "...America Retail".
      ["C-0001", "name_prefix"],
      ["B-0101", "name_prefix"],
      // "Northwind" only starts with the query word, so it ranks after whole-word matches.
      ["A-0015", "name_prefix"],
    ]);
  });

  it("keeps one entity's series from different services together", () => {
    expect(ids("acme")).toEqual(["A-0001", "C-0039", "A-0002", "C-0040"]);
  });

  it("ranks whole-word matches above partial ones within a tier", () => {
    // 'energy' is a whole word in all four names; 'ener' is partial everywhere.
    expect(ids("energy").slice(0, 4).sort()).toEqual(["A-0004", "B-0132", "C-0032", "C-0042"].sort());
    expect(ids("cascade energy")).toEqual(["A-0004", "C-0042"]);
  });

  it("matches facets, ranked below name matches", () => {
    const hits = searchCatalogs(CATALOGS, "technology");
    const tiers = hits.map((h) => [h.series.id, h.tier]);
    expect(tiers.slice(0, 2)).toEqual([
      ["C-0031", "name_prefix"],
      ["B-0131", "name_prefix"],
    ]);
    expect(tiers).toContainEqual(["A-0001", "facet"]);
    expect(tiers.findIndex(([, t]) => t === "facet")).toBeGreaterThan(1);
  });

  it("combines name and facet words", () => {
    // 'acme' from the name, 'technology' from alpha's sector facet.
    expect(ids("acme technology")).toEqual(["A-0001"]);
  });

  it("is case-insensitive for mixed-case names", () => {
    expect(ids("acme industries")).toEqual(["A-0002", "C-0040"]);
  });

  it("breaks exact ties by service order", () => {
    const twins: CatalogInput[] = [
      { service: "x", series: [s("x", "X-1", "Same Name")] },
      { service: "y", series: [s("y", "Y-1", "Same Name")] },
    ];
    expect(searchCatalogs(twins, "same").map((h) => h.series.service)).toEqual(["x", "y"]);
  });
});

describe("matchesQuery", () => {
  const acme = s("alpha", "A-0001", "Acme Corp (ACMC)", [["group", "Technology"]]);

  it("uses the same rule as the global search", () => {
    expect(matchesQuery(acme, "")).toBe(true);
    expect(matchesQuery(acme, "acme corp")).toBe(true);
    expect(matchesQuery(acme, "acmc")).toBe(true);
    expect(matchesQuery(acme, "tech")).toBe(true);
    expect(matchesQuery(acme, "a-00")).toBe(true);
    expect(matchesQuery(acme, "corp energy")).toBe(false);
    expect(matchesQuery(acme, "cme")).toBe(false);
  });
});
