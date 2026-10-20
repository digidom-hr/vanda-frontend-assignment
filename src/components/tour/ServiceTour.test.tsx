import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceTour } from "./ServiceTour";
import { SERVICE_TOUR, TOUR_START_EVENT, TOUR_STORAGE_KEY } from "./tour";

/** The page's tour targets; `missing` ones aren't rendered. */
function Page({ ready = true, missing = [] as string[] }) {
  return (
    <>
      {["search", "picker", "view-controls", "transforms", "navigator", "panel-view"]
        .filter((name) => !missing.includes(name))
        .map((name) => (
          <div key={name} data-tour={name}>
            {name}
          </div>
        ))}
      <ServiceTour ready={ready} />
    </>
  );
}

const startTimers = () => act(() => vi.advanceTimersByTime(1000));

describe("ServiceTour", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // jsdom has no layout: let tour targets count as on screen.
    vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
      return (this.hasAttribute("data-tour") ? [new DOMRect(0, 0, 10, 10)] : []) as unknown as DOMRectList;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts by itself on the first visit, at step 1", async () => {
    render(<Page />);
    await startTimers();
    const dialog = screen.getByRole("dialog", { name: SERVICE_TOUR[0]?.title });
    expect(dialog).toHaveTextContent(`Step 1 of ${SERVICE_TOUR.length}`);
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });

  it("waits until the page is ready", async () => {
    render(<Page ready={false} />);
    await startTimers();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("moves through the steps and remembers when it's done", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Page />);
    await startTimers();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: SERVICE_TOUR[1]?.title })).toHaveTextContent("Step 2 of 6");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: SERVICE_TOUR[0]?.title })).toBeInTheDocument();

    for (let i = 0; i < SERVICE_TOUR.length - 1; i++) await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByRole("button", { name: "Skip tour" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe("done");
  });

  it("skips steps whose control isn't on the page", async () => {
    render(<Page missing={["navigator"]} />);
    await startTimers();
    expect(screen.getByRole("dialog")).toHaveTextContent(`Step 1 of ${SERVICE_TOUR.length - 1}`);
  });

  it("closes with Escape and doesn't start by itself again", async () => {
    const { unmount } = render(<Page />);
    await startTimers();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe("done");

    unmount();
    render(<Page />);
    await startTimers();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("replays on request, even after it was seen", async () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "done");
    render(<Page />);
    await startTimers();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event(TOUR_START_EVENT));
    });
    expect(screen.getByRole("dialog", { name: SERVICE_TOUR[0]?.title })).toBeInTheDocument();
  });
});
