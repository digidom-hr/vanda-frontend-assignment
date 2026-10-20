import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RangeNavigatorProps } from "./RangeNavigator";
import { RangeNavigator } from "./RangeNavigator";

// Highcharts itself is exercised in the browser (e2e); here a stand-in reports a range like the navigator does.
vi.mock("./RangeNavigator.client", () => ({
  default: ({ onCommit }: RangeNavigatorProps) => (
    <button type="button" onClick={() => onCommit({ min: Date.UTC(2025, 0, 6), max: Date.UTC(2025, 0, 8) })}>
      navigator
    </button>
  ),
}));

const DAY = 86_400_000;
const t = Array.from({ length: 10 }, (_, i) => Date.UTC(2025, 0, 1) + i * DAY); // 1..10 Jan
const values = t.map((_, i) => 100 + i);

describe("RangeNavigator", () => {
  it("states the period in dates and data points, for everyone", async () => {
    render(
      <RangeNavigator
        t={t}
        values={values}
        range={{ min: Date.UTC(2025, 0, 3), max: Date.UTC(2025, 0, 7) }}
        onCommit={() => {}}
        label="Time range for Acme Corp"
      />,
    );
    expect(screen.getByRole("group", { name: "Time range for Acme Corp" })).toBeInTheDocument();
    const caption = screen.getByText("3 Jan 2025 to 7 Jan 2025, 5 data points");
    expect(caption).toHaveAttribute("aria-live", "polite");
  });

  it("passes the user's range on", async () => {
    const onCommit = vi.fn();
    render(
      <RangeNavigator
        t={t}
        values={values}
        range={{ min: t[0] as number, max: t[9] as number }}
        onCommit={onCommit}
        label="Range"
      />,
    );
    await userEvent.click(await screen.findByRole("button", { name: "navigator" }));
    expect(onCommit).toHaveBeenCalledWith({ min: Date.UTC(2025, 0, 6), max: Date.UTC(2025, 0, 8) });
  });

  it("offers the period and its edges as sliders that speak dates", () => {
    render(
      <RangeNavigator
        t={t}
        values={values}
        range={{ min: t[2] as number, max: t[6] as number }}
        onCommit={() => {}}
        label="Range"
      />,
    );
    expect(screen.getByRole("slider", { name: "Selected period" })).toHaveAttribute(
      "aria-valuetext",
      "3 Jan 2025 to 7 Jan 2025",
    );
    expect(screen.getByRole("slider", { name: "Start of period" })).toHaveAttribute("aria-valuetext", "3 Jan 2025");
    expect(screen.getByRole("slider", { name: "End of period" })).toHaveAttribute("aria-valuetext", "7 Jan 2025");
  });

  it("moves one edge by one data point per arrow key, leaving the other where it is", async () => {
    const onCommit = vi.fn();
    render(
      <RangeNavigator
        t={t}
        values={values}
        range={{ min: t[2] as number, max: t[6] as number }}
        onCommit={onCommit}
        label="Range"
      />,
    );
    screen.getByRole("slider", { name: "End of period" }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onCommit).toHaveBeenLastCalledWith({ min: t[2], max: t[5] });

    screen.getByRole("slider", { name: "Selected period" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onCommit).toHaveBeenLastCalledWith({ min: t[3], max: t[7] });
  });

  it("shows nothing for fewer than two points", () => {
    const { container } = render(
      <RangeNavigator t={[1]} values={[1]} range={{ min: 1, max: 1 }} onCommit={() => {}} label="Range" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
