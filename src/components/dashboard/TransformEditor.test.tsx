import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TransformSpec } from "@/lib/transforms/pipeline";
import { TransformEditor } from "./TransformEditor";

function setup(transforms: TransformSpec[] = [], frequency: "daily" | "weekly" | "5min" = "daily") {
  const onChange = vi.fn();
  render(<TransformEditor transforms={transforms} onChange={onChange} frequency={frequency} />);
  return { onChange, user: userEvent.setup() };
}

const openForm = async (user: ReturnType<typeof userEvent.setup>, name = "Add transform") => {
  await user.click(screen.getByRole("button", { name }));
  return screen.findByRole("dialog", { name: "Add a transform" });
};

describe("TransformEditor", () => {
  it("adds a moving average with a sensible default window for the frequency", async () => {
    const { user, onChange } = setup([], "weekly");
    const dialog = await openForm(user);
    expect(within(dialog).getByRole("radio", { name: /Moving average/ })).toBeChecked();
    // Keyboard users land on the choice, not on the dialog container.
    await waitFor(() => expect(within(dialog).getByRole("radio", { name: /Moving average/ })).toHaveFocus());
    expect(within(dialog).getByText("Average of the last N weeks")).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "Window (weeks)" })).toHaveValue("4");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(onChange).toHaveBeenCalledWith([{ kind: "movingAverage", window: 4 }]);
  });

  it("adds percent change against an earlier point", async () => {
    const { user, onChange } = setup();
    const dialog = await openForm(user);
    await user.click(within(dialog).getByRole("radio", { name: /Percent change/ }));
    const field = within(dialog).getByRole("textbox", { name: "Compare with (days earlier)" });
    await user.clear(field);
    await user.type(field, "5");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(onChange).toHaveBeenCalledWith([{ kind: "pctChange", periods: 5 }]);
  });

  it("adds a z-score over the whole history, or a rolling window when chosen", async () => {
    const first = setup();
    let dialog = await openForm(first.user);
    await first.user.click(within(dialog).getByRole("radio", { name: /Z-score/ }));
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    await first.user.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(first.onChange).toHaveBeenLastCalledWith([{ kind: "zScore" }]);

    dialog = await openForm(first.user);
    await first.user.click(within(dialog).getByRole("radio", { name: /Z-score/ }));
    await first.user.click(within(dialog).getByRole("checkbox", { name: /rolling window/ }));
    expect(within(dialog).getByRole("textbox", { name: "Window (days)" })).toHaveValue("60");
    await first.user.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(first.onChange).toHaveBeenLastCalledWith([{ kind: "zScore", window: 60 }]);
  });

  it("does not add an invalid window", async () => {
    const { user, onChange } = setup();
    const dialog = await openForm(user);
    const field = within(dialog).getByRole("textbox", { name: "Window (days)" });
    await user.clear(field);
    await user.tab(); // the field commits its value when focus leaves it
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the chain in order and removes or clears steps", async () => {
    const chain: TransformSpec[] = [
      { kind: "movingAverage", window: 20 },
      { kind: "pctChange", periods: 1 },
    ];
    const { user, onChange } = setup(chain);
    const list = screen.getByRole("list", { name: "Applied transforms, in order" });
    expect(list).toHaveTextContent("MA(20)then%Δ");

    await user.click(screen.getByRole("button", { name: "Remove MA(20)" }));
    expect(onChange).toHaveBeenLastCalledWith([{ kind: "pctChange", periods: 1 }]);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("stops at the step limit and says so", () => {
    setup([{ kind: "cumulative" }, { kind: "cumulative" }, { kind: "cumulative" }, { kind: "cumulative" }]);
    expect(screen.getByRole("button", { name: "Add another" })).toBeDisabled();
    expect(screen.getByText("Up to 4 steps")).toBeInTheDocument();
  });
});
