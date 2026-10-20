import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly", isDisabled: true },
] as const;

describe("SegmentedControl", () => {
  it("is a labelled radio group with the value checked", () => {
    render(<SegmentedControl label="Frequency" options={OPTIONS} value="daily" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Frequency" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Daily" })).toBeChecked();
  });

  it("reports a new choice, and ignores clicks on the current one", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl label="Frequency" options={OPTIONS} value="daily" onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Daily" }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "Weekly" }));
    expect(onChange).toHaveBeenCalledWith("weekly");
  });

  it("supports arrow keys and skips disabled options", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl label="Frequency" options={OPTIONS} value="daily" onChange={onChange} />);
    await user.tab();
    await user.keyboard("{ArrowRight}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("weekly");
    expect(screen.getByRole("radio", { name: "Monthly" })).toBeDisabled();
  });

  it("can show no selection (e.g. while a custom range is active)", () => {
    render(<SegmentedControl label="Range" options={OPTIONS} value={null} onChange={() => {}} />);
    expect(screen.getAllByRole("radio").filter((r) => (r as HTMLInputElement).checked)).toHaveLength(0);
  });

  it("names icon-only options", () => {
    render(
      <SegmentedControl
        label="Theme"
        options={[{ id: "dark", label: <svg />, ariaLabel: "Use dark theme" }]}
        value="dark"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: "Use dark theme" })).toBeInTheDocument();
  });
});
