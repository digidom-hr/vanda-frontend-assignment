import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getService } from "@/services/registry";
import { renderWithProviders, stubApi } from "@/test/render";
import type { CharlieLatest } from "./meta";
import { groupLatest, SignalBoard } from "./SignalBoard";

const item = (
  seriesId: string,
  name: string,
  category: string,
  value: number,
  signal: CharlieLatest["signal"],
): CharlieLatest => ({
  seriesId,
  name,
  category,
  t: Date.UTC(2025, 11, 31),
  value,
  unit: "score",
  signal,
});

const LATEST = [
  item("C-0001", "North America Equity Composite", "equity", 0.97, "mid"),
  item("C-0011", "Japan Equity Composite", "equity", 1.4, "high"),
  item("C-0002", "North America Rates Composite", "rates", -1.2, "low"),
];

describe("groupLatest", () => {
  it("groups by category and sorts strongest first", () => {
    expect(groupLatest(LATEST).map((g) => [g.label, g.items.map((i) => i.seriesId)])).toEqual([
      ["Equity", ["C-0011", "C-0001"]],
      ["Rates", ["C-0002"]],
    ]);
  });
});

describe("SignalBoard", () => {
  const ctx = {
    service: getService("charlie"),
    series: [
      {
        service: "charlie",
        id: "C-0001",
        name: "x",
        facets: [],
        frequencies: ["daily" as const],
        unit: "score",
        fields: ["value"],
      },
    ],
    columns: new Map(),
    frequency: "daily" as const,
    range: { min: 0, max: 1 },
    transforms: [],
  };

  it("lists latest scores with signals as words, counts them, and marks the shown series", async () => {
    stubApi(() => Response.json({ latest: LATEST }));
    renderWithProviders(<SignalBoard ctx={ctx} onShowSeries={() => {}} />);
    const list = await screen.findByRole("grid", { name: "Latest signals" });
    expect(screen.getByText("Latest score per series on 31 Dec 2025")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Signal board" })).toHaveTextContent("1 high, 1 mid, 1 low");

    const japan = within(list).getByRole("row", { name: /Japan Equity/ });
    expect(japan).toHaveTextContent("1.40");
    expect(japan).toHaveTextContent("High");
    expect(within(list).getByRole("row", { name: /North America Equity/ })).toHaveAttribute("data-shown");
  });

  it("shows a series when its row is pressed", async () => {
    stubApi(() => Response.json({ latest: LATEST }));
    const onShowSeries = vi.fn();
    renderWithProviders(<SignalBoard ctx={ctx} onShowSeries={onShowSeries} />);
    await userEvent.click(await screen.findByText("North America Rates Composite"));
    expect(onShowSeries).toHaveBeenCalledWith("C-0002");
  });

  it("offers a retry when the latest values can't load", async () => {
    stubApi(() =>
      Response.json(
        { error: { code: "unavailable", message: "The data service is unavailable.", retryable: true } },
        { status: 503 },
      ),
    );
    renderWithProviders(<SignalBoard ctx={null} onShowSeries={() => {}} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The data service is unavailable."));
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
