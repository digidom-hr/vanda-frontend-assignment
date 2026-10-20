import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";
import type { SeriesMeta } from "@/services/types";
import { stubApi } from "@/test/render";
import { ServiceDashboard } from "./ServiceDashboard";

vi.mock("@/components/charts/RangeNavigator.client", () => ({ default: () => null }));
vi.mock("@/components/charts/TimeChart", () => ({
  preloadTimeChart: vi.fn(),
  TimeChart: ({ spec }: { spec: { title: string } }) => <div data-testid="chart">{spec.title}</div>,
}));

const meta = (id: string, fields: string[], unit: string): SeriesMeta => ({
  service: "bravo",
  id,
  name: `${id} name`,
  facets: [{ key: "region", label: "Region", value: "North America" }],
  frequencies: ["daily", "weekly", "monthly"],
  unit,
  fields,
});

describe("ServiceDashboard (bravo)", () => {
  it("requests and shows only what a net-only series has", async () => {
    const fetchMock = stubApi((url) => {
      if (url.pathname === "/api/bravo/series") {
        return Response.json({
          service: "bravo",
          series: [meta("B-0139", ["net"], "bps"), meta("B-0101", ["net", "gross"], "USD")],
        });
      }
      const fields = (url.searchParams.get("fields") ?? "").split(",");
      // Like the real API: asking a net-only series for gross is a 400.
      if (fields.includes("gross")) {
        return Response.json(
          { error: { code: "bad_request", message: "Unknown fields: gross", retryable: false } },
          { status: 400 },
        );
      }
      return Response.json({
        service: "bravo",
        frequency: "daily",
        series: [{ seriesId: "B-0139", t: [Date.UTC(2025, 11, 31)], fields: { net: [1.5] } }],
      });
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NuqsTestingAdapter searchParams="?series=B-0139">
          <ServiceDashboard serviceId="bravo" />
        </NuqsTestingAdapter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getAllByTestId("chart").map((c) => c.textContent)).toEqual(["Net flow", "Cumulative net flow"]),
    );
    expect(screen.queryByRole("heading", { name: "Gross flow" })).not.toBeInTheDocument();
    const requested = fetchMock.mock.calls.map(([u]) =>
      new URL(String(u), "http://app.test").searchParams.get("fields"),
    );
    expect(requested.filter(Boolean).every((f) => f === "net")).toBe(true);
  });
});
