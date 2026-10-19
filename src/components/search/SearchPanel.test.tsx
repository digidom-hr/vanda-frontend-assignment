import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SearchResponse, SearchResult } from "@/services/api-types";
import { renderWithProviders, stubApi } from "@/test/render";
import { SearchPanel, seriesHref } from "./SearchPanel";

const result = (service: string, id: string, name: string, facets: [string, string, string][] = []): SearchResult => ({
  service,
  id,
  name,
  facets: facets.map(([key, label, value]) => ({ key, label, value })),
  frequencies: ["daily"],
  unit: "USD",
  match: "name_prefix",
});

const ACME = [
  result("alpha", "A-0001", "Acme Corp (ACMC)", [["group", "Sector", "Technology"]]),
  result("charlie", "C-0039", "Acme Corp Composite", [["category", "Category", "single_name"]]),
];

// These tests drive the field with fireEvent rather than user-event. React
// Aria's Autocomplete dispatches focus/blur events from inside React commits
// to move virtual focus; user-event answers a blur by dispatching a wrapped
// "change" event, which nests act() inside React's own work and fails with
// "Should not already be working". fireEvent installs no such listeners.
const typeInto = (text: string) =>
  fireEvent.change(screen.getByRole("searchbox", { name: "Search series" }), { target: { value: text } });
const pressKey = (key: string) => {
  const input = screen.getByRole("searchbox", { name: "Search series" });
  fireEvent.keyDown(input, { key });
  fireEvent.keyUp(input, { key });
};

const ok = (services: string[] = ["alpha", "bravo", "charlie"]) =>
  services.map((service) => ({ service, status: "ok" as const }));

function respond(body: Partial<SearchResponse> & { query: string }) {
  return Response.json({ total: body.results?.length ?? 0, results: [], services: ok(), ...body });
}

describe("seriesHref", () => {
  it("links to the service page with the series in view", () => {
    expect(seriesHref({ service: "bravo", id: "B-0101" })).toBe("/bravo?series=B-0101");
  });
});

describe("SearchPanel", () => {
  it("suggests example queries before anything is typed", async () => {
    const fetchMock = stubApi(() => respond({ query: "Acme", results: ACME }));
    renderWithProviders(<SearchPanel variant="inline" />);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Acme" }));
    expect(screen.getByRole("searchbox", { name: "Search series" })).toHaveValue("Acme");
    expect(await screen.findAllByRole("option")).toHaveLength(2);
  });

  it("shows results from every service in one ranked list with their service", async () => {
    stubApi(() => respond({ query: "acme", results: ACME }));
    renderWithProviders(<SearchPanel variant="inline" />);
    typeInto("acme");

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Acme Corp (ACMC)"),
      expect.stringContaining("Acme Corp Composite"),
    ]);
    expect(within(options[0] as HTMLElement).getByText("Alpha")).toBeInTheDocument();
    expect(within(options[1] as HTMLElement).getByText("Single name")).toBeInTheDocument();
    // Matched prefixes are marked.
    expect(within(options[0] as HTMLElement).getAllByText("Acme", { selector: "mark" })).toHaveLength(1);
    await waitFor(() => expect(screen.getByText("2 series match.")).toBeInTheDocument());
  });

  it("debounces typing into a single request", async () => {
    const fetchMock = stubApi((url) => respond({ query: url.searchParams.get("q") ?? "", results: ACME }));
    renderWithProviders(<SearchPanel variant="inline" />);
    typeInto("acme");
    await screen.findAllByRole("option");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/search?q=acme&limit=20");
  });

  it("opens the highlighted result with Enter and reports the navigation", async () => {
    stubApi(() => respond({ query: "acme", results: ACME }));
    const onNavigate = vi.fn();
    const { navigate } = renderWithProviders(<SearchPanel variant="dialog" onNavigate={onNavigate} />);
    typeInto("acme");
    await screen.findAllByRole("option");

    // Arrow keys move the active result; the field keeps focus (aria-activedescendant).
    const input = screen.getByRole("searchbox", { name: "Search series" });
    for (let i = 0; i < 3 && !input.getAttribute("aria-activedescendant")?.endsWith("charlie:C-0039"); i++) {
      pressKey("ArrowDown");
    }
    expect(input).toHaveFocus();
    expect(input.getAttribute("aria-activedescendant")).toMatch(/charlie:C-0039$/);

    pressKey("Enter");
    expect(navigate.mock.calls.map(([href]) => href)).toEqual(["/charlie?series=C-0039"]);
    expect(onNavigate).toHaveBeenCalled();
  });

  it("explains an empty result", async () => {
    stubApi(() => respond({ query: "zzqx" }));
    renderWithProviders(<SearchPanel variant="inline" />);
    typeInto("zzqx");
    expect(await screen.findByText(/No series match “zzqx”/)).toBeInTheDocument();
  });

  it("says which services are missing when results are partial", async () => {
    stubApi(() =>
      respond({
        query: "acme",
        results: ACME,
        services: [...ok(["alpha", "charlie"]), { service: "bravo", status: "unavailable" }],
      }),
    );
    renderWithProviders(<SearchPanel variant="inline" />);
    typeInto("acme");
    expect(
      await screen.findByText("Bravo is unavailable, so its series are missing from these results."),
    ).toBeInTheDocument();
  });

  it("reports the total when only the first results are shown", async () => {
    stubApi(() => respond({ query: "japan", results: ACME, total: 22 }));
    renderWithProviders(<SearchPanel variant="inline" />);
    typeInto("japan");
    expect(await screen.findByText("Showing 2 of 22 matches. Add words to narrow the list.")).toBeInTheDocument();
  });

  it("shows the server's message when search fails, and retries on request", async () => {
    let fail = true;
    stubApi(() =>
      fail
        ? Response.json(
            { error: { code: "unavailable", message: "No data service could be searched.", retryable: true } },
            { status: 503 },
          )
        : respond({ query: "acme", results: ACME }),
    );
    renderWithProviders(<SearchPanel variant="inline" />);
    typeInto("acme");
    expect(await screen.findByRole("alert")).toHaveTextContent("No data service could be searched.");

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findAllByRole("option")).toHaveLength(2);
  });
});
