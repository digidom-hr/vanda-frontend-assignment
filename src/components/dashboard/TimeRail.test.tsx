import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimeRail } from "./TimeRail";

const DAY = 86_400_000;
const t = Array.from({ length: 100 }, (_, i) => Date.UTC(2025, 0, 1) + i * DAY);
const values = t.map((_, i) => 100 + i);
const at = (i: number) => t[i] as number;

function setup(start = 40, end = 59) {
  const onCommit = vi.fn();
  render(<TimeRail t={t} values={values} range={{ min: at(start), max: at(end) }} onCommit={onCommit} />);
  return { onCommit, last: () => onCommit.mock.calls.at(-1)?.[0] as { min: number; max: number } };
}

const period = () => screen.getByRole("slider", { name: "Selected period" });
const startHandle = () => screen.getByRole("slider", { name: "Start of period" });
const endHandle = () => screen.getByRole("slider", { name: "End of period" });

describe("TimeRail", () => {
  it("is a labelled group of three sliders that speak in dates", () => {
    setup();
    expect(screen.getByRole("group", { name: "Time range" })).toBeInTheDocument();
    expect(period()).toHaveAttribute("aria-valuetext", "10 Feb 2025 to 1 Mar 2025");
    expect(startHandle()).toHaveAttribute("aria-valuetext", "10 Feb 2025");
    expect(endHandle()).toHaveAttribute("aria-valuetext", "1 Mar 2025");
    expect(screen.getByText("10 Feb 2025 to 1 Mar 2025, 20 data points")).toBeInTheDocument();
  });

  it("moves the whole period with arrow keys, one point at a time", () => {
    const { last } = setup();
    fireEvent.keyDown(period(), { key: "ArrowRight" });
    expect(last()).toEqual({ min: at(41), max: at(60) });
  });

  it("moves by a larger step with Shift, and to the ends with Home/End", () => {
    const { last } = setup();
    fireEvent.keyDown(period(), { key: "ArrowLeft", shiftKey: true });
    expect(last().min).toBeLessThan(at(40) - 20 * DAY);
    fireEvent.keyDown(period(), { key: "End" });
    expect(last()).toEqual({ min: at(80), max: at(99) });
    fireEvent.keyDown(period(), { key: "Home" });
    expect(last()).toEqual({ min: at(0), max: at(19) });
  });

  it("resizes one edge without moving the other", () => {
    const { last, onCommit } = setup();
    fireEvent.keyDown(startHandle(), { key: "ArrowLeft" });
    expect(last()).toEqual({ min: at(39), max: at(59) });
    fireEvent.keyDown(endHandle(), { key: "End" });
    expect(last()).toEqual({ min: at(40), max: at(99) });
    // A handled key must not also reach the period slider around the handle.
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it("follows a drag live and commits once, on release", () => {
    const { onCommit, last } = setup();
    const rail = period().parentElement as HTMLElement;
    vi.spyOn(rail, "getBoundingClientRect").mockReturnValue({ left: 0, width: 990, top: 0, height: 56 } as DOMRect);
    rail.setPointerCapture = vi.fn();

    // Each point is 10px wide on this 990px rail; drag the period 100px right.
    fireEvent.pointerDown(period(), { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(rail, { clientX: 600, pointerId: 1 });
    expect(onCommit).not.toHaveBeenCalled();
    expect(period()).toHaveAttribute("aria-valuetext", "20 Feb 2025 to 11 Mar 2025");

    fireEvent.pointerUp(rail, { pointerId: 1 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(last()).toEqual({ min: at(50), max: at(69) });
  });

  it("renders nothing without enough data", () => {
    const { container } = render(<TimeRail t={[1]} values={[1]} range={{ min: 1, max: 1 }} onCommit={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
