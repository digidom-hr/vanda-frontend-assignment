import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";
import type { SeriesMeta } from "@/services/types";
import { stubApi } from "@/test/render";
import { DASHBOARDS } from "./configs";
import { ServiceDashboard } from "./ServiceDashboard";

// The chart itself is tested elsewhere; here it only shows what it was given.
vi.mock("@/components/charts/TimeChart", () => ({
  preloadTimeChart: vi.fn(),
  TimeChart: ({ spec }: { spec: { unit: string; series: { name: string }[] } }) => (
    <div data-testid="chart">
      {spec.series.map((s) => s.name).join(", ")} ({spec.unit})
    </div>
  ),
}));

const meta = (id: string, name: string, frequencies: SeriesMeta["frequencies"] = ["daily"]): SeriesMeta => ({
  service: "alpha",
  id,
  name,
  facets: [{ key: "group", label: "Sector", value: "Technology" }],
  frequencies,
  unit: "USD",
  fields: ["price"],
});

const CATALOG = [meta("A-0001", "Acme Corp (ACMC)", ["daily", "5min"]), meta("A-0013", "Lumen Technologies (LUMT)")];

function api({ failCatalog = false, tooLarge = false } = {}) {
  return stubApi((url) => {
    if (tooLarge && url.searchParams.get("frequency") === "5min") {
      return Response.json(
        {
          error: {
            code: "too_large",
            message: "This request returns 609,804 values (limit 400,000).",
            retryable: false,
          },
        },
        { status: 413 },
      );
    }
    if (url.pathname === "/api/alpha/series") {
      return failCatalog
        ? Response.json(
            { error: { code: "unavailable", message: "The data service is unavailable.", retryable: true } },
            { status: 503 },
          )
        : Response.json({ service: "alpha", series: CATALOG });
    }
    const ids = (url.searchParams.get("ids") ?? "").split(",");
    return Response.json({
      service: "alpha",
      frequency: url.searchParams.get("frequency"),
      series: ids.map((id) => ({
        seriesId: id,
        t: [Date.UTC(2025, 11, 30), Date.UTC(2025, 11, 31)],
        fields: { price: [100, 101] },
      })),
    });
  });
}

function setup(search = "", options?: { failCatalog?: boolean; tooLarge?: boolean }) {
  return setupWithClient(search, options);
}

function setupWithClient(search = "", options?: { failCatalog?: boolean; tooLarge?: boolean }) {
  const fetchMock = api(options);
  const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} hasMemory>
        <ServiceDashboard serviceId="alpha" />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { fetchMock, onUrlUpdate, client, user: userEvent.setup() };
}

describe("ServiceDashboard", () => {
  it("shows the first series when the URL names none", async () => {
    setup();
    expect(await screen.findByRole("heading", { level: 1, name: "Acme Corp (ACMC)" })).toBeInTheDocument();
    expect(await screen.findByTestId("chart")).toHaveTextContent("Acme Corp (ACMC) (USD)");
    expect(screen.getByText("101.00 USD")).toBeInTheDocument();
  });

  it("opens the series a search result linked to", async () => {
    setup("?series=A-0013");
    expect(await screen.findByRole("heading", { level: 1, name: "Lumen Technologies (LUMT)" })).toBeInTheDocument();
  });

  it("explains series ids it doesn't know", async () => {
    setup("?series=A-0013,NOPE-1");
    expect(await screen.findByText("NOPE-1 isn't in Alpha, so it isn't shown.")).toBeInTheDocument();
  });

  it("compares series rebased to 100 after a checkbox is ticked", async () => {
    const { user, onUrlUpdate } = setup();
    await user.click(await screen.findByRole("checkbox", { name: "Compare Lumen Technologies (LUMT)" }));
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe("?series=A-0001,A-0013");
    await waitFor(() =>
      expect(screen.getByTestId("chart")).toHaveTextContent("Acme Corp (ACMC), Lumen Technologies (LUMT) (index)"),
    );
    expect(screen.getByText("Comparing 2 series")).toBeInTheDocument();
  });

  it("requests intraday data for the visible range only", async () => {
    const { fetchMock } = setup("?freq=5min&range=1M");
    // The stub's data starts on 30 Dec, so "last month" is clamped to it.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls
          .map(([u]) => new URL(String(u), "http://app.test").searchParams)
          .some((p) => p.get("frequency") === "5min" && p.get("from") === "2025-12-30" && p.get("to") === "2025-12-31"),
      ).toBe(true),
    );
  });

  it("only offers frequencies every shown series has", async () => {
    setup("?series=A-0001,A-0013");
    const header = await screen.findByRole("heading", { level: 1 });
    expect(header).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Frequency" })).not.toBeInTheDocument();
    expect(within(document.body).getAllByText("Daily").length).toBeGreaterThan(0);
  });

  it("shows a page-level error with retry when the catalog can't load", async () => {
    const { user, fetchMock } = setup("", { failCatalog: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("The data service is unavailable.");
    const calls = fetchMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(calls));
  });

  it("does not rebuild charts when a refetch returns the same data", async () => {
    const build = vi.spyOn(DASHBOARDS.alpha.panels[0] as { build: (...args: never[]) => unknown }, "build");
    const { client } = setup();
    await screen.findByTestId("chart");
    await waitFor(() => expect(screen.getByText("101.00 USD")).toBeInTheDocument());
    const before = build.mock.calls.length;

    await client.refetchQueries();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(build.mock.calls.length).toBe(before);
  });

  it("shows one notice with a fix, not an error in every panel, when the range is too large", async () => {
    const { user, onUrlUpdate } = setup("?freq=5min&range=All", { tooLarge: true });
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("This range has too much 5-minute data to load at once.");
    expect(screen.getAllByText("Choose a shorter range to load this panel.").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Show the last year" }));
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("range")).toBeNull(); // 1Y is the default
  });
});
