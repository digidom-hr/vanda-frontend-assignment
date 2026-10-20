import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SeriesMeta } from "@/services/types";
import { SeriesPicker, type SeriesPickerProps } from "./SeriesPicker";

const meta = (id: string, name: string, region: string, unit = "USD"): SeriesMeta => ({
  service: "bravo",
  id,
  name,
  facets: [{ key: "region", label: "Region", value: region }],
  frequencies: ["daily"],
  unit,
  fields: ["net"],
});

const SERIES = [
  meta("B-0101", "North America Retail Activity", "North America"),
  meta("B-0102", "North America Institutional Activity", "North America"),
  meta("B-0106", "Europe Retail Activity", "Europe"),
  meta("B-0139", "North America Net Activity (bps)", "North America", "bps"),
];

function setup(props: Partial<SeriesPickerProps> = {}) {
  const onShow = vi.fn();
  const onToggleCompare = vi.fn();
  render(
    <SeriesPicker
      label="Bravo series"
      series={SERIES}
      groupBy="region"
      selected={["B-0101"]}
      maxSelected={6}
      onShow={onShow}
      onToggleCompare={onToggleCompare}
      {...props}
    />,
  );
  return { onShow, onToggleCompare, user: userEvent.setup(), list: screen.getByRole("grid", { name: "Bravo series" }) };
}

const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("SeriesPicker", () => {
  it("groups series by the chosen facet", () => {
    const { list } = setup();
    expect(within(list).getByText("North America")).toBeInTheDocument();
    expect(within(list).getByText("Europe")).toBeInTheDocument();
    expect(
      within(list)
        .getAllByRole("row")
        .filter((r) => r.getAttribute("data-key")?.startsWith("B-")),
    ).toHaveLength(4);
  });

  it("updates the marks when the selection changes from outside (e.g. the signal board)", () => {
    const props = {
      label: "Bravo series",
      series: SERIES,
      groupBy: "region",
      maxSelected: 6,
      onShow: () => {},
      onToggleCompare: () => {},
    };
    const { rerender } = render(<SeriesPicker {...props} selected={["B-0101"]} />);
    rerender(<SeriesPicker {...props} selected={["B-0106"]} />);
    expect(row("Europe Retail Activity")).toHaveAttribute("data-primary");
    expect(row("North America Retail Activity")).not.toHaveAttribute("data-primary");
    expect(screen.getByRole("checkbox", { name: /^Compare Europe Retail Activity/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^Compare North America Retail Activity/ })).not.toBeChecked();
  });

  it("marks the shown series and its comparison checkbox", () => {
    setup();
    expect(row("North America Retail Activity")).toHaveAttribute("data-primary");
    expect(screen.getByRole("checkbox", { name: /^Compare North\ America\ Retail\ Activity/ })).toBeChecked();
  });

  it("shows a series when its row is pressed", async () => {
    const { user, onShow, onToggleCompare } = setup();
    await user.click(screen.getByText("Europe Retail Activity"));
    expect(onShow).toHaveBeenCalledWith("B-0106");
    expect(onToggleCompare).not.toHaveBeenCalled();
  });

  it("adds a series to the comparison with its checkbox", async () => {
    const { user, onShow, onToggleCompare } = setup();
    await user.click(screen.getByRole("checkbox", { name: /^Compare Europe\ Retail\ Activity/ }));
    expect(onToggleCompare).toHaveBeenCalledWith("B-0106");
    expect(onShow).not.toHaveBeenCalled();
  });

  it("explains why a series can't join the comparison, but still lets you open it", async () => {
    const { user, onShow } = setup({
      compareBlockedReason: (s) => (s.unit !== "USD" ? `Different unit (${s.unit})` : null),
    });
    expect(within(row("Net Activity")).getByText("Different unit (bps)")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /^Compare North\ America\ Net\ Activity\ \(bps\)/ })).toBeDisabled();
    await user.click(screen.getByText("North America Net Activity (bps)"));
    expect(onShow).toHaveBeenCalledWith("B-0139");
  });

  it("stops adding at the comparison limit", () => {
    setup({ selected: ["B-0101", "B-0102"], maxSelected: 2 });
    expect(screen.getByRole("checkbox", { name: /^Compare Europe\ Retail\ Activity/ })).toBeDisabled();
    expect(within(row("Europe Retail")).getByText("Compare up to 2 series")).toBeInTheDocument();
  });

  it("filters with the global search rule and says when nothing matches", async () => {
    const { user, list } = setup();
    await user.type(screen.getByRole("searchbox", { name: "Filter Bravo series" }), "europe");
    expect(within(list).queryByText("North America Retail Activity")).not.toBeInTheDocument();
    expect(within(list).getByText("Europe Retail Activity")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), " zzz");
    expect(screen.getByText(/No series match/)).toBeInTheDocument();
  });

  it("is one Tab stop with arrow-key navigation", async () => {
    const { user, onShow, onToggleCompare } = setup();
    await user.tab(); // filter
    await user.tab(); // list
    expect(document.activeElement?.closest("[role=grid]")).toBe(screen.getByRole("grid"));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onShow).toHaveBeenCalledWith("B-0102");
    await user.keyboard("{ArrowRight}{ }");
    expect(onToggleCompare).toHaveBeenCalledWith("B-0102");
  });

  it("never lets the last series be removed", () => {
    setup();
    expect(screen.getByRole("checkbox", { name: /^Compare North America Retail Activity/ })).toBeDisabled();
  });
});
