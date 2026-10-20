import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SeriesMeta } from "@/services/types";
import { renderWithProviders, stubApi } from "@/test/render";
import HomePage from "./page";

const series = (service: string, id: string, facets: [string, string][]): SeriesMeta => ({
  service,
  id,
  name: `${id} name`,
  facets: facets.map(([label, value]) => ({ key: label.toLowerCase(), label, value })),
  frequencies: ["daily"],
  unit: "USD",
  fields: ["price"],
});

const CATALOGS: Record<string, SeriesMeta[]> = {
  alpha: [
    series("alpha", "A-0001", [["Sector", "Technology"]]),
    series("alpha", "A-0002", [["Sector", "Industrials"]]),
    series("alpha", "A-0003", [["Sector", "Technology"]]),
  ],
  bravo: [
    series("bravo", "B-0101", [
      ["Region", "Europe"],
      ["Category", "Retail"],
    ]),
  ],
  charlie: [series("charlie", "C-0001", [["Category", "Equity"]])],
};

function api() {
  return stubApi((url) => {
    const service = url.pathname.split("/")[2] ?? "";
    if (url.pathname.endsWith("/series")) return Response.json({ service, series: CATALOGS[service] ?? [] });
    const id = url.searchParams.get("ids") ?? "";
    return Response.json({
      series: [
        {
          seriesId: id,
          t: [Date.UTC(2021, 0, 4), Date.UTC(2025, 11, 31)],
          fields: { price: [1, 2], net: [1, 2], value: [1, 2] },
        },
      ],
    });
  });
}

describe("HomePage", () => {
  it("leads with search and links to every data service", () => {
    api();
    renderWithProviders(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Search, chart and transform every series" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search series" })).toBeInTheDocument();
    const links = screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["Alpha", "/alpha"],
      ["Bravo", "/bravo"],
      ["Charlie", "/charlie"],
    ]);
  });

  it("describes each service with its frequencies and live counts from the catalogs", async () => {
    api();
    renderWithProviders(<HomePage />);
    expect(await screen.findByText(/^5 series across 3 services/)).toBeInTheDocument();

    const alpha = screen.getByRole("link", { name: "Alpha" }).closest("li") as HTMLElement;
    expect(within(alpha).getByRole("list", { name: "Frequencies" })).toHaveTextContent("Daily5 min");
    expect(within(alpha).getByText("series").nextElementSibling).toHaveTextContent("3");
    expect(within(alpha).getByText("sectors").nextElementSibling).toHaveTextContent("2");
    expect(await within(alpha).findByText("A-0001 name, 4 Jan 2021 to 31 Dec 2025")).toBeInTheDocument();

    const bravo = screen.getByRole("link", { name: "Bravo" }).closest("li") as HTMLElement;
    expect(within(bravo).getByText("region").nextElementSibling).toHaveTextContent("1");
  });
});
