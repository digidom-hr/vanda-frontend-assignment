import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TableData } from "@/components/charts/chart-table";
import { ApiError } from "@/lib/api-client";
import { Panel, type PanelProps } from "./Panel";

const TABLE: TableData = {
  caption: "Price (USD)",
  columns: [
    { key: "date", label: "Date", numeric: false },
    { key: "p", label: "Acme Corp", numeric: true },
  ],
  rows: [
    { key: "1", cells: ["3 Jan 2025", "182.40"] },
    { key: "2", cells: ["2 Jan 2025", null] },
  ],
};

const renderPanel = (props: Partial<PanelProps> = {}) =>
  render(
    <Panel title="Price" status="success" bodyHeight={200} {...props}>
      {props.children ?? <div>chart</div>}
    </Panel>,
  );

function Boom(): never {
  throw new Error("render failed");
}

describe("Panel", () => {
  it("is a labelled section with its chart", () => {
    renderPanel({ subtitle: "Daily close", readout: "182.40 USD" });
    const region = screen.getByRole("region", { name: "Price" });
    expect(within(region).getByText("chart")).toBeInTheDocument();
    expect(within(region).getByText("Daily close")).toBeInTheDocument();
    expect(within(region).getByText("182.40 USD")).toBeInTheDocument();
  });

  it("reserves its height and announces loading", () => {
    const { container } = renderPanel({ status: "pending" });
    expect(screen.getByText("Loading Price")).toBeInTheDocument();
    expect(screen.queryByText("chart")).not.toBeInTheDocument();
    expect(container.querySelector("[style*='min-height: 200px']")).not.toBeNull();
  });

  it("explains a load that takes longer than usual", () => {
    vi.useFakeTimers();
    try {
      renderPanel({ status: "pending" });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(5000));
      expect(screen.getByRole("status")).toHaveTextContent("it can take up to a minute to start");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the server's message and offers a retry for retryable errors", async () => {
    const onRetry = vi.fn();
    renderPanel({
      status: "error",
      error: new ApiError("unavailable", "The data service is unavailable.", 503, true),
      onRetry,
    });
    expect(screen.getByRole("alert")).toHaveTextContent("The data service is unavailable.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("does not offer a retry that cannot help", () => {
    renderPanel({
      status: "error",
      error: new ApiError("bad_request", "A-0002 has no 5min data.", 400, false),
      onRetry: vi.fn(),
    });
    expect(screen.getByRole("alert")).toHaveTextContent("A-0002 has no 5min data.");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("explains an empty result", () => {
    renderPanel({ isEmpty: true });
    expect(screen.getByText("No data in this range. Choose a longer range.")).toBeInTheDocument();
  });

  it("keeps showing the chart while refreshing", () => {
    renderPanel({ isRefreshing: true });
    expect(screen.getByText("chart")).toBeInTheDocument();
    expect(screen.getByText("chart").parentElement).toHaveAttribute("data-refreshing");
  });

  it("switches between chart and an accessible table", async () => {
    const user = userEvent.setup();
    renderPanel({ table: TABLE });
    await user.click(screen.getByRole("radio", { name: "Table" }));

    const table = screen.getByRole("table", { name: "Price (USD)" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Date", "Acme Corp"]);
    expect(within(table).getByRole("rowheader", { name: "3 Jan 2025" })).toBeInTheDocument();
    expect(within(table).getByText("No data")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Price (USD) table" })).toHaveAttribute("tabindex", "0");
    expect(screen.queryByText("chart")).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Chart" }));
    expect(screen.getByText("chart")).toBeInTheDocument();
  });

  it("contains a render error to the panel and lets the user retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <Panel title="Broken" status="success" bodyHeight={100}>
          <Boom />
        </Panel>
        <p>Rest of the page</p>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Broken failed to display.");
    expect(screen.getByText("Rest of the page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
