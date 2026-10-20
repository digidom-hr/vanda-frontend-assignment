import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FrequencyControl, RangeControl } from "./ViewControls";

describe("FrequencyControl", () => {
  it("offers the available frequencies", async () => {
    const onChange = vi.fn();
    render(<FrequencyControl frequencies={["daily", "weekly", "monthly"]} value="daily" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Weekly" }));
    expect(onChange).toHaveBeenCalledWith("weekly");
  });

  it("shows a single frequency as the same control, selected, so it reads like the other pages", async () => {
    const onChange = vi.fn();
    render(<FrequencyControl frequencies={["daily"]} value="daily" onChange={onChange} />);
    const daily = screen.getByRole("radio", { name: "Daily" });
    expect(daily).toHaveAttribute("aria-checked", "true");
    await userEvent.click(daily);
    expect(onChange).not.toHaveBeenCalled(); // nothing to switch to
  });
});

describe("RangeControl", () => {
  it("offers presets with descriptive names", async () => {
    const onPreset = vi.fn();
    render(<RangeControl preset="1Y" from={null} to={null} onPreset={onPreset} />);
    expect(screen.getByRole("radio", { name: "Last year" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Last 6 months" }));
    expect(onPreset).toHaveBeenCalledWith("6M");
  });

  it("shows a custom range instead of a selected preset", () => {
    render(<RangeControl preset="1Y" from="2025-07-01" to="2025-09-30" onPreset={() => {}} />);
    expect(screen.getByText("1 Jul 2025 to 30 Sep 2025")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").some((r) => (r as HTMLInputElement).checked)).toBe(false);
  });
});
